import { ConflictException } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJob,
  AndroidAppLifecycleJobKind,
} from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppsLifecycleTransitionService } from './android-apps-lifecycle-transition.service';

describe('AndroidAppsLifecycleTransitionService', () => {
  const createService = () => {
    const app = Object.assign(new AndroidApplication(), {
      id: 'app-1',
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
      statusMessage: 'Stopped.',
    });
    const jobs = new Map<string, AndroidAppLifecycleJob>();
    const applicationRepository = {
      findOneBy: jest.fn(async () => app),
      save: jest.fn(async (value) => value),
    };
    const jobRepository = {
      findOneBy: jest.fn(
        async ({ applicationId }: { applicationId: string }) =>
          jobs.get(applicationId) ?? null,
      ),
      create: jest.fn((value) =>
        Object.assign(new AndroidAppLifecycleJob(), value),
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
    await service.beginJob('app-1', AndroidAppLifecycleJobKind.Provision, {
      status: AndroidApplicationStatus.Provisioning,
    });
    await service.handoffJob(
      'app-1',
      AndroidAppLifecycleJobKind.Provision,
      AndroidAppLifecycleJobKind.InstallApk,
      {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      },
    );

    const staleCompletion = await service.completeJob(
      'app-1',
      AndroidAppLifecycleJobKind.Provision,
      { status: AndroidApplicationStatus.Error },
    );
    expect(staleCompletion).toBe(false);
    expect(app.status).toBe(AndroidApplicationStatus.Running);
    expect(jobs.get('app-1')?.kind).toBe(AndroidAppLifecycleJobKind.InstallApk);
  });

  it('cancels active work before recording a stop', async () => {
    const { app, jobs, service } = createService();
    await service.beginJob('app-1', AndroidAppLifecycleJobKind.Start, {
      status: AndroidApplicationStatus.Provisioning,
    });
    await service.cancelActiveJob('app-1', {
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
    });

    expect(jobs.size).toBe(0);
    expect(app.status).toBe(AndroidApplicationStatus.Stopped);
    await expect(
      service.updateProgress('app-1', AndroidAppLifecycleJobKind.Start, {
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
});
