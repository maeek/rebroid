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
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsPowerService } from '../../lifecycle/services/android-apps-power.service';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidAppsQueryService } from './android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from './android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from './android-apps-state-writer.service';
import { AndroidAppsRuntimeOperationGate } from './android-apps-runtime-operation-gate.service';
import { AndroidAppsStatusService } from './android-apps-status.service';
import { InactivityService } from './inactivity.service';
import { LifecycleBackgroundJobRunner } from '../../lifecycle/services/lifecycle-background-job-runner.service';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';

describe('committed application changes', () => {
  let database: SerializedSqliteDataSource;
  let app: AndroidApplication;
  let transitions: AndroidAppsLifecycleTransitionService;
  let appendLifecycle: jest.Mock;

  beforeEach(async () => {
    database = await new SerializedSqliteDataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [AndroidApplication, AndroidAppLifecycleJob],
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
    }).initialize();
    const rows = database.getRepository(AndroidApplication);
    app = await rows.save(
      rows.create({
        name: 'Demo',
        containerImage: 'fixture',
        containerName: 'demo',
        networkName: 'demo',
        volumeName: 'demo',
        networkPolicyAllowCidrs: '[]',
        savedProfilesJson: '[]',
        status: AndroidApplicationStatus.Stopped,
        lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
      }),
    );
    appendLifecycle = jest
      .fn()
      .mockRejectedValue(new Error('diagnostics offline'));
    transitions = new AndroidAppsLifecycleTransitionService(
      database,
      { appendLifecycle } as never,
      { isEnabled: () => false } as never,
      { deleteIfStale: async () => {} } as never,
    );
  });

  afterEach(async () => {
    await database.destroy();
  });

  it('dispatches a committed Recreate and completes it despite failed diagnostics', async () => {
    const runner = new LifecycleBackgroundJobRunner(
      { maxConcurrentJobs: 1 } as never,
      new AndroidAppsProvisioningTrackerService(),
    );
    let complete!: () => void;
    const finished = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const worker = jest.fn(async (reservation: AndroidAppLifecycleJob) => {
      expect(await transitions.claimJob(reservation)).toBe(true);
      expect(
        await transitions.completeJob(reservation, {
          status: AndroidApplicationStatus.Running,
          lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        }),
      ).toBe(true);
      complete();
    });
    await runner.submit(
      transitions.beginJob(app.id, AndroidAppLifecycleJobKind.Recreate, {
        status: AndroidApplicationStatus.Provisioning,
      }),
      (reservation) => worker(reservation as AndroidAppLifecycleJob),
    );
    await finished;
    expect(worker).toHaveBeenCalledTimes(1);
    expect(appendLifecycle).toHaveBeenCalledTimes(2);
  });

  it('preserves a newer viewer observation and refuses to reinsert a deleted app', async () => {
    const rows = database.getRepository(AndroidApplication);
    const observed = new Date('2026-01-01T00:00:00Z');
    await rows.update(app.id, { lastScrcpyActivityAt: observed });
    await expect(
      transitions.updateConfiguration(app.id, () => ({ name: 'Renamed' })),
    ).resolves.toMatchObject({
      name: 'Renamed',
      lastScrcpyActivityAt: observed,
    });
    await rows.delete(app.id);
    await expect(
      transitions.updateConfiguration(app.id, () => ({
        name: 'Delayed rename',
      })),
    ).rejects.toThrow('not found');
    await expect(rows.findOneBy({ id: app.id })).resolves.toBeNull();
  });

  it.each([
    ['viewer activity', { lastScrcpyActivityAt: new Date('2099-01-01') }],
    ['disabled timeout', { inactivityTimeoutSeconds: -1 }],
    ['extended timeout', { inactivityTimeoutSeconds: 3600 }],
    ['replacement container', { containerId: 'next-container' }],
    [
      'restart in the same container',
      { lastStartedAt: new Date('2099-01-01') },
    ],
  ] as const)(
    'declines inactivity Stop after a change to %s',
    async (_reason, change) => {
      const rows = database.getRepository(AndroidApplication);
      const candidate = {
        id: app.id,
        containerId: 'current-container',
        lastStartedAt: new Date(Date.now() - 60_000),
      };
      await rows.update(app.id, {
        ...candidate,
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        inactivityTimeoutSeconds: 30,
      });

      await rows.update(app.id, change);

      await expect(
        transitions.admitInactiveStop(candidate),
      ).resolves.toBeNull();
      await expect(rows.findOneByOrFail({ id: app.id })).resolves.toMatchObject(
        {
          ...change,
          status: AndroidApplicationStatus.Running,
        },
      );
      expect(appendLifecycle).not.toHaveBeenCalled();
    },
  );

  it('admits an overdue runtime only once and leaves the last activity intact', async () => {
    const rows = database.getRepository(AndroidApplication);
    const candidate = {
      id: app.id,
      containerId: 'current-container',
      lastStartedAt: new Date(Date.now() - 120_000),
    };
    const lastScrcpyActivityAt = new Date(Date.now() - 60_000);
    await rows.update(app.id, {
      ...candidate,
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.Ready,
      inactivityTimeoutSeconds: 30,
      lastScrcpyActivityAt,
    });

    await expect(
      transitions.admitInactiveStop(candidate),
    ).resolves.toMatchObject({
      ...candidate,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
      status: AndroidApplicationStatus.Stopped,
      lastScrcpyActivityAt,
    });
    await expect(transitions.admitInactiveStop(candidate)).resolves.toBeNull();
  });

  it('stops only the still-idle runtime when the scheduled sweep reaches Docker', async () => {
    const rows = database.getRepository(AndroidApplication);
    const lastStartedAt = new Date(Date.now() - 120_000);
    const lastScrcpyActivityAt = new Date();
    await rows.update(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.Ready,
      containerId: 'current-container',
      inactivityTimeoutSeconds: 30,
      lastStartedAt,
    });
    const status = new AndroidAppsStatusService();
    const applications = new AndroidApplicationsRepository(rows);
    const queries = new AndroidAppsQueryService(applications, status);
    const docker = {
      getContainerRuntimeState: jest
        .fn()
        .mockImplementationOnce(async () => {
          await rows.update(app.id, { lastScrcpyActivityAt });
          return { exists: true, running: true };
        })
        .mockResolvedValue({ exists: true, running: true }),
      stopContainer: jest.fn(),
    };
    const reconciler = new AndroidAppsRuntimeStateReconciler(
      {} as never,
      docker as never,
      {} as never,
      status,
      queries,
      new AndroidAppsStateWriter(applications, status, {
        deleteIfStale: jest.fn(),
      } as never),
      new AndroidAppsProvisioningTrackerService(),
    );
    const power = new AndroidAppsPowerService(
      docker as never,
      {} as never,
      { hasWork: () => false } as never,
      {
        append: jest.fn().mockRejectedValueOnce(new Error('log unavailable')),
      } as never,
      queries,
      reconciler,
      { releaseDisplaySessions: jest.fn() } as never,
      {} as never,
      {} as never,
      transitions,
      {} as never,
    );
    const lifecycle = new AndroidAppsLifecycleService(
      {} as never,
      power,
      {} as never,
      new AndroidAppsRuntimeOperationGate(queries, docker as never),
    );
    const sweep = new InactivityService(queries, lifecycle);

    await sweep.stopInactiveApplications();
    expect(docker.stopContainer).not.toHaveBeenCalled();
    await expect(queries.getStored(app.id)).resolves.toMatchObject({
      status: AndroidApplicationStatus.Running,
      lastScrcpyActivityAt,
    });

    await rows.update(app.id, { lastScrcpyActivityAt: lastStartedAt });
    await sweep.stopInactiveApplications();
    expect(docker.stopContainer.mock.calls).toEqual([['current-container', 0]]);
    await expect(queries.getStored(app.id)).resolves.toMatchObject({
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
    });

    await rows.update(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.Ready,
      containerId: null,
      lastScrcpyActivityAt: lastStartedAt,
    });
    await sweep.stopInactiveApplications();
    expect(docker.stopContainer).toHaveBeenCalledTimes(1);
    expect(docker.getContainerRuntimeState).toHaveBeenCalledTimes(2);
    await expect(queries.getStored(app.id)).resolves.toMatchObject({
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
      containerId: null,
    });
  });

  it('keeps replacement intent when runtime creation used older settings', async () => {
    const reservation = await transitions.beginJob(
      app.id,
      AndroidAppLifecycleJobKind.Start,
      { status: AndroidApplicationStatus.Provisioning },
    );
    await transitions.claimJob(reservation);
    await transitions.updateConfiguration(app.id, () => ({
      memoryLimitMb: 1024,
      recreateContainerOnNextStart: true,
    }));
    await transitions.updateProgress(
      reservation,
      { containerId: 'new-container' },
      {
        containerArgs: app.containerArgs,
        memoryLimitMb: app.memoryLimitMb,
        cpuLimitCpus: app.cpuLimitCpus,
      },
    );
    await expect(
      database.getRepository(AndroidApplication).findOneBy({ id: app.id }),
    ).resolves.toMatchObject({
      containerId: 'new-container',
      memoryLimitMb: 1024,
      recreateContainerOnNextStart: true,
    });
  });
});

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
        { deleteIfStale: jest.fn() } as never,
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
    const snapshots = { deleteIfStale: jest.fn() };
    const service = new AndroidAppsLifecycleTransitionService(
      dataSource as never,
      logs as never,
      { isEnabled: () => true } as never,
      snapshots as never,
    );
    return { app, jobs, logs, service, snapshots };
  };

  it('clears the snapshot once when Stop leaves the running state', async () => {
    const { app, service, snapshots } = createService();
    app.status = AndroidApplicationStatus.Running;
    await service.cancelActiveJob(app.id, {
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
    });
    await service.markState(app.id, {
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
    });
    expect(snapshots.deleteIfStale).toHaveBeenCalledTimes(1);
    expect(snapshots.deleteIfStale).toHaveBeenCalledWith(app.id);
  });

  it('clears a snapshot when Remove reserves the application', async () => {
    const { app, service, snapshots } = createService();
    app.status = AndroidApplicationStatus.Running;
    await service.beginJob(app.id, AndroidAppLifecycleJobKind.Remove, {
      status: AndroidApplicationStatus.Removing,
      lifecycleStage: AndroidApplicationLifecycleStage.Removing,
    });
    expect(snapshots.deleteIfStale).toHaveBeenCalledTimes(1);
    expect(snapshots.deleteIfStale).toHaveBeenCalledWith(app.id);
  });

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
