import { SerializedSqliteDataSource } from '../../../database/serialized-sqlite-data-source';
import { InitializeSqliteSchema1800000005000 } from '../../../database/migrations/1800000005000-initialize-sqlite-schema';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsRuntimeOperationGate } from '../../common/services/android-apps-runtime-operation-gate.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsRuntimeActivationService } from '../../provisioning/services/android-apps-runtime-activation.service';
import { AndroidAppLifecycleJob } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppsLifecycleService } from './android-apps-lifecycle.service';
import { AndroidAppsPowerService } from './android-apps-power.service';
import { AndroidAppsStartLifecycleService } from './android-apps-start-lifecycle.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';

const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

describe('Android application power commands', () => {
  it('drains container creation before Stop and fences callbacks from the old Start', async () => {
    const db = await new SerializedSqliteDataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [AndroidApplication, AndroidAppLifecycleJob],
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
    }).initialize();
    const creating = deferred();
    const releaseCreate = deferred();
    const stopping = deferred();
    const startingAgain = deferred();
    const releaseRestart = deferred();
    const ready = deferred();
    let stop: Promise<unknown> | undefined;
    try {
      const apps = db.getRepository(AndroidApplication);
      const app = await apps.save(
        apps.create({
          name: 'Fixture',
          containerImage: 'fixture',
          containerName: 'fixture',
          networkName: 'fixture',
          volumeName: 'fixture',
          networkPolicyEnabled: false,
          networkPolicyAllowCidrs: '[]',
          savedProfilesJson: '[]',
          status: AndroidApplicationStatus.Stopped,
          lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
        }),
      );
      const logs = {
        append: jest.fn(),
        appendLifecycle: jest.fn(
          (_id: string, patch: Partial<AndroidApplication>) => {
            if (patch.lifecycleStage === AndroidApplicationLifecycleStage.Ready)
              ready.release();
          },
        ),
      };
      const transitions = new AndroidAppsLifecycleTransitionService(
        db,
        logs as never,
        { isEnabled: () => true } as never,
      );
      const tracker = new AndroidAppsProvisioningTrackerService();
      const cancel = tracker.cancel.bind(tracker);
      jest.spyOn(tracker, 'cancel').mockImplementation((id) => {
        cancel(id);
        stopping.release();
      });
      const queries = {
        getStored: (id: string) => apps.findOneByOrFail({ id }),
        decorate: (stored: AndroidApplication) => stored,
      };
      const runner = new LifecycleBackgroundJobRunner(
        { maxConcurrentJobs: 1 } as never,
        tracker,
      );
      const docker = {
        startContainer: jest.fn(async () => {
          startingAgain.release();
          await releaseRestart.promise;
        }),
        stopContainer: jest.fn(),
      };
      const activation = new AndroidAppsRuntimeActivationService(
        {} as never,
        docker as never,
        {
          createApplicationContainer: async () => {
            creating.release();
            await releaseCreate.promise;
            return { id: 'container-created-during-stop' };
          },
        } as never,
        { imageExists: async () => true } as never,
        { engineSummary: async () => ({}) } as never,
        { shouldPrepareRemoteAccess: () => false } as never,
        {
          attachRuntimeSupport: jest.fn(),
          createRuntimeBoundary: jest.fn(),
          startWithPolicy: (
            _app: AndroidApplication,
            start: () => Promise<void>,
          ) => start(),
        } as never,
        transitions,
        tracker,
        logs as never,
        {
          resolve: async () => ({ rendering: null }),
          removeIfConfigurationChanged: async () => false,
          explainDeviceError: (error: unknown) => error,
        } as never,
      );
      const apk = { launchInstalledApk: jest.fn() };
      const startWorker = new AndroidAppsStartLifecycleService(
        activation,
        {} as never,
        {} as never,
        apk as never,
        transitions,
        tracker,
        logs as never,
        queries as never,
      );
      const power = new AndroidAppsPowerService(
        docker as never,
        apk as never,
        runner,
        logs as never,
        queries as never,
        {
          reconcileBeforeStop: queries.getStored,
          reconcileResultById: async (id: string) => ({
            application: await queries.getStored(id),
            outcome: 'unchanged',
          }),
        } as never,
        { releaseDisplaySessions: jest.fn() } as never,
        {
          prepareRuntimeDefaults: jest.fn(),
          prepareFailedContainerForRestart: jest.fn(),
          prepareContainerForRecreationOnStart: jest.fn(),
        } as never,
        startWorker,
        transitions,
        {} as never,
      );
      const commands = new AndroidAppsLifecycleService(
        {} as never,
        power,
        {} as never,
        new AndroidAppsRuntimeOperationGate(queries as never),
      );

      await commands.start(app.id);
      await creating.promise;
      const [first] = await transitions.listJobs();
      stop = commands.stop(app.id);
      await stopping.promise;
      expect(docker.stopContainer).not.toHaveBeenCalled();
      await expect(commands.start(app.id)).rejects.toThrow(
        'Another application command',
      );
      releaseCreate.release();
      await expect(stop).resolves.toMatchObject({
        status: AndroidApplicationStatus.Stopped,
      });
      expect(docker.stopContainer).toHaveBeenCalledWith(
        'container-created-during-stop',
        0,
      );
      expect(docker.startContainer).not.toHaveBeenCalled();

      await commands.start(app.id);
      await startingAgain.promise;
      const [second] = await transitions.listJobs();
      expect(second.id).not.toBe(first.id);
      await expect(
        transitions.updateProgress(first, { statusMessage: 'Late update' }),
      ).resolves.toBe(false);
      await expect(
        transitions.completeJob(first, {
          status: AndroidApplicationStatus.Error,
        }),
      ).resolves.toBe(false);
      expect((await transitions.listJobs())[0].id).toBe(second.id);
      releaseRestart.release();
      await ready.promise;
      expect((await queries.getStored(app.id)).status).toBe(
        AndroidApplicationStatus.Running,
      );
    } finally {
      releaseCreate.release();
      releaseRestart.release();
      await stop?.catch(() => undefined);
      await db.destroy();
    }
  });
});
