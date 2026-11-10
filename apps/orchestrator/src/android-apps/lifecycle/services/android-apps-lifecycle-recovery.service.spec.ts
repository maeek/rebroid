import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJobKind,
  AndroidAppLifecycleJobStatus,
} from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppsLifecycleRecoveryService } from './android-apps-lifecycle-recovery.service';

describe('AndroidAppsLifecycleRecoveryService', () => {
  const createService = (
    apps: Record<string, unknown>[],
    activeJobs: Record<string, unknown>[] = [],
  ) => {
    const applications = {
      findById: jest.fn(
        async (id) => apps.find((app) => app.id === id) ?? null,
      ),
      findAll: jest.fn(async () => apps),
    };
    const apkInstall = { resume: jest.fn() };
    const backgroundJobs = { schedule: jest.fn() };
    const provisioning = { provision: jest.fn() };
    const removal = { resume: jest.fn() };
    const startLifecycle = { startInBackground: jest.fn() };
    const transitions = {
      listJobs: jest.fn(async () => activeJobs),
      requeueInterruptedJob: jest.fn().mockResolvedValue(true),
      discardJob: jest.fn(),
      completeJob: jest.fn().mockResolvedValue(true),
      markState: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AndroidAppsLifecycleRecoveryService(
      applications as never,
      apkInstall as never,
      backgroundJobs as never,
      provisioning as never,
      removal as never,
      startLifecycle as never,
      transitions as never,
    );
    return {
      apkInstall,
      backgroundJobs,
      removal,
      service,
      transitions,
    };
  };

  it('resumes the exact persisted operation without inferring another kind', async () => {
    const app = {
      id: 'app-1',
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
    };
    const job = {
      applicationId: 'app-1',
      kind: AndroidAppLifecycleJobKind.Start,
      status: AndroidAppLifecycleJobStatus.Running,
      payloadJson: null,
    };
    const { backgroundJobs, service, transitions } = createService(
      [app],
      [job],
    );

    await service.recover();

    expect(transitions.requeueInterruptedJob).toHaveBeenCalledWith(job);
    expect(backgroundJobs.schedule).toHaveBeenCalledWith(
      job,
      expect.any(Function),
    );
  });

  it('marks orphaned background state as an error instead of guessing work', async () => {
    const app = {
      id: 'app-1',
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
    };
    const { backgroundJobs, service, transitions } = createService([app]);

    await service.recover();

    expect(backgroundJobs.schedule).not.toHaveBeenCalled();
    expect(transitions.markState).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ status: AndroidApplicationStatus.Error }),
    );
  });

  it('terminalizes a reservation that disagrees with stored state', async () => {
    const app = {
      id: 'app-1',
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
    };
    const job = {
      applicationId: 'app-1',
      kind: AndroidAppLifecycleJobKind.InstallApk,
      status: AndroidAppLifecycleJobStatus.Pending,
      payloadJson: null,
    };
    const { service, transitions } = createService([app], [job]);

    await service.recover();

    expect(transitions.completeJob).toHaveBeenCalledWith(
      job,
      expect.objectContaining({ status: AndroidApplicationStatus.Error }),
    );
  });

  it('fails interrupted Recreate even when it was installing an APK', async () => {
    const app = {
      id: 'app-1',
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
    };
    const job = {
      id: 'recreate-1',
      applicationId: app.id,
      kind: AndroidAppLifecycleJobKind.Recreate,
      status: AndroidAppLifecycleJobStatus.Running,
    };
    const { service, transitions, backgroundJobs, apkInstall } = createService(
      [app],
      [job],
    );

    await service.recover();

    expect(transitions.completeJob).toHaveBeenCalledWith(
      job,
      expect.objectContaining({
        status: AndroidApplicationStatus.Error,
        lastError: expect.stringContaining('recreation was interrupted'),
      }),
    );
    expect(backgroundJobs.schedule).not.toHaveBeenCalled();
    expect(apkInstall.resume).not.toHaveBeenCalled();
  });
});
