import { ConflictException } from '@nestjs/common';
import { SerializedSqliteDataSource } from '../../../database/serialized-sqlite-data-source';
import { InitializeSqliteSchema1800000005000 } from '../../../database/migrations/1800000005000-initialize-sqlite-schema';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJob,
  AndroidAppLifecycleJobKind,
  AndroidAppLifecycleJobStatus,
} from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppsLifecycleTransitionService } from './android-apps-lifecycle-transition.service';

describe('open application admission', () => {
  it('allows one concurrent Create, Start or Recreate at the owner limit', async () => {
    const database = await new SerializedSqliteDataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [AndroidApplication, AndroidAppLifecycleJob],
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
    }).initialize();
    try {
      const apps = database.getRepository(AndroidApplication);
      const quotaEnabled = jest.fn(() => true);
      const job = new AndroidAppsLifecycleTransitionService(
        database,
        { appendLifecycle: jest.fn() } as never,
        { isEnabled: quotaEnabled } as never,
      );
      const makeApp = (name: string, ownerUserId = 'owner') =>
        apps.create({
          name,
          ownerUserId,
          containerImage: 'fixture',
          containerName: name,
          networkName: name,
          volumeName: name,
          networkPolicyAllowCidrs: '[]',
          savedProfilesJson: '[]',
          status: AndroidApplicationStatus.Stopped,
          lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
        });
      const [start, recreate] = await apps.save([
        makeApp('start'),
        makeApp('recreate'),
      ]);
      const create = makeApp('create');
      const patch = { status: AndroidApplicationStatus.Provisioning };
      const outcomes = await Promise.allSettled([
        job.beginJob(
          start.id,
          AndroidAppLifecycleJobKind.Start,
          patch,
          undefined,
          true,
          1,
        ),
        job.beginJob(
          recreate.id,
          AndroidAppLifecycleJobKind.Recreate,
          patch,
          undefined,
          true,
          1,
        ),
        job.createProvisionJob(Object.assign(create, patch), 1),
      ]);
      expect(outcomes).toEqual([
        {
          status: 'fulfilled',
          value: expect.objectContaining({
            kind: AndroidAppLifecycleJobKind.Start,
          }),
        },
        expect.objectContaining({
          status: 'rejected',
          reason: expect.any(ConflictException),
        }),
        expect.objectContaining({
          status: 'rejected',
          reason: expect.any(ConflictException),
        }),
      ]);
      expect(await apps.countBy({ ownerUserId: 'owner', ...patch })).toBe(1);
      expect(await apps.countBy({ ownerUserId: 'owner' })).toBe(2);
      quotaEnabled.mockReturnValue(false);
      await expect(
        job.createProvisionJob(
          Object.assign(makeApp('quota-disabled'), patch),
          1,
        ),
      ).resolves.toMatchObject({ kind: AndroidAppLifecycleJobKind.Provision });
      await expect(
        job.createProvisionJob(
          Object.assign(makeApp('other', 'other'), patch),
          1,
        ),
      ).resolves.toMatchObject({ kind: AndroidAppLifecycleJobKind.Provision });
      await job.cancelActiveJob(start.id, {
        status: AndroidApplicationStatus.Stopped,
        lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
      });
      await expect(job.createProvisionJob(create, 1)).resolves.toMatchObject({
        kind: AndroidAppLifecycleJobKind.Provision,
      });
    } finally {
      await database.destroy();
    }
  });
});

describe('AndroidAppsLifecycleTransitionService', () => {
  const createService = () => {
    const app = Object.assign(new AndroidApplication(), {
      id: 'app-1',
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
      statusMessage: 'Stopped.',
    });
    const jobs = new Map<string, AndroidAppLifecycleJob>();
    let nextId = 0;
    const applicationRepository = {
      findOneBy: jest.fn(async () => app),
      save: jest.fn(async (value) => value),
    };
    const jobRepository = {
      findOneBy: jest.fn(
        async ({
          applicationId,
          id,
          kind,
          status,
        }: Partial<AndroidAppLifecycleJob>) => {
          const job = applicationId ? jobs.get(applicationId) : undefined;
          if (
            !job ||
            (id && id !== job.id) ||
            (kind && kind !== job.kind) ||
            (status && status !== job.status)
          )
            return null;
          return job;
        },
      ),
      create: jest.fn((value) =>
        Object.assign(
          new AndroidAppLifecycleJob(),
          { id: String(++nextId) },
          value,
        ),
      ),
      save: jest.fn(async (job: AndroidAppLifecycleJob) => {
        jobs.set(job.applicationId, job);
        return job;
      }),
      remove: jest.fn(async (job: AndroidAppLifecycleJob) => {
        jobs.delete(job.applicationId);
        return job;
      }),
      delete: jest.fn(async ({ applicationId }: { applicationId: string }) => {
        jobs.delete(applicationId);
      }),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === AndroidApplication ? applicationRepository : jobRepository,
      ),
    };
    const dataSource = {
      transaction: jest.fn(async (operation) => operation(manager)),
    };
    const logs = { appendLifecycle: jest.fn().mockResolvedValue(undefined) };
    const service = new AndroidAppsLifecycleTransitionService(
      dataSource as never,
      logs as never,
      { isEnabled: () => true } as never,
    );
    return { app, jobs, logs, service };
  };

  it('keeps one active lifecycle reservation per application', async () => {
    const { jobs, service } = createService();
    await service.beginJob('app-1', AndroidAppLifecycleJobKind.Provision, {
      status: AndroidApplicationStatus.Provisioning,
    });

    await expect(
      service.beginJob('app-1', AndroidAppLifecycleJobKind.Start, {}),
    ).rejects.toBeInstanceOf(ConflictException);

    await service.beginJob(
      'app-1',
      AndroidAppLifecycleJobKind.Start,
      {},
      undefined,
      true,
    );
    expect(jobs.size).toBe(1);
    expect(jobs.get('app-1')?.kind).toBe(AndroidAppLifecycleJobKind.Start);
  });

  it('prevents stale work from completing after a handoff', async () => {
    const { app, jobs, service } = createService();
    const old = await service.beginJob(
      'app-1',
      AndroidAppLifecycleJobKind.Provision,
      {
        status: AndroidApplicationStatus.Provisioning,
      },
    );
    old.status = AndroidAppLifecycleJobStatus.Running;
    await service.handoffJob(old, AndroidAppLifecycleJobKind.InstallApk, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
    });

    const staleCompletion = await service.completeJob(old, {
      status: AndroidApplicationStatus.Error,
    });
    expect(staleCompletion).toBe(false);
    expect(app.status).toBe(AndroidApplicationStatus.Running);
    expect(jobs.get('app-1')?.kind).toBe(AndroidAppLifecycleJobKind.InstallApk);
  });

  it('cancels active work before recording a stop', async () => {
    const { app, jobs, service } = createService();
    const old = await service.beginJob(
      'app-1',
      AndroidAppLifecycleJobKind.Start,
      {
        status: AndroidApplicationStatus.Provisioning,
      },
    );
    await service.cancelActiveJob('app-1', {
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
    });

    expect(jobs.size).toBe(0);
    expect(app.status).toBe(AndroidApplicationStatus.Stopped);
    await expect(
      service.updateProgress(old, {
        status: AndroidApplicationStatus.Running,
      }),
    ).resolves.toBe(false);
    expect(app.status).toBe(AndroidApplicationStatus.Stopped);
  });

  it('rejects invalid state transitions', async () => {
    const { app, service } = createService();
    app.status = AndroidApplicationStatus.Removed;

    await expect(
      service.markState('app-1', {
        status: AndroidApplicationStatus.Running,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks conflicting commands while a runtime is being recreated', async () => {
    const { jobs, service } = createService();
    const kind = AndroidAppLifecycleJobKind.Recreate;
    const patch = {
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
    };
    await service.beginJob('app-1', kind, patch);

    await expect(
      service.beginJob('app-1', kind, patch, undefined, true),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.beginJob(
        'app-1',
        AndroidAppLifecycleJobKind.Start,
        patch,
        undefined,
        true,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.cancelActiveJob('app-1', {
        status: AndroidApplicationStatus.Stopped,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(jobs.get('app-1')?.kind).toBe(kind);
  });
});
