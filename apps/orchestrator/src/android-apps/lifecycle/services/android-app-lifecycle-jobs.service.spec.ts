import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';

describe('AndroidAppLifecycleJobsService', () => {
  const createRepository = () => {
    const records = new Map<string, Record<string, unknown>>();
    const repository = {
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => {
        records.set(value.applicationId, { ...value });
        return value;
      }),
      findByApplication: jest.fn(
        async (applicationId: string) => records.get(applicationId) ?? null,
      ),
      deleteByApplicationAndKind: jest.fn(
        async (applicationId: string, kind: AndroidAppLifecycleJobKind) => {
          const record = records.get(applicationId);
          if (record?.kind === kind) records.delete(applicationId);
        },
      ),
      deleteByApplication: jest.fn(async (applicationId: string) => {
        records.delete(applicationId);
      }),
      listActive: jest.fn(async () => [...records.values()]),
    };
    return { records, repository };
  };

  it('preserves recovery payload while recording attempts and failures', async () => {
    const { records, repository } = createRepository();
    const jobs = new AndroidAppLifecycleJobsService(repository as never);

    await jobs.enqueue('app-1', AndroidAppLifecycleJobKind.InstallApk, {
      statusMessage: 'Install after restart.',
    });
    await jobs.markRunning('app-1', AndroidAppLifecycleJobKind.InstallApk);
    await jobs.markFailed(
      'app-1',
      AndroidAppLifecycleJobKind.InstallApk,
      'adb unavailable',
    );

    expect(records.get('app-1')).toMatchObject({
      attempts: 1,
      payloadJson: '{"statusMessage":"Install after restart."}',
      lastError: 'adb unavailable',
      status: 'pending',
    });
  });

  it('removes all queued work after an application is deleted', async () => {
    const { records, repository } = createRepository();
    const jobs = new AndroidAppLifecycleJobsService(repository as never);

    await jobs.enqueue('app-1', AndroidAppLifecycleJobKind.Start);
    await jobs.enqueue('app-1', AndroidAppLifecycleJobKind.Remove);
    expect(records.get('app-1')).toMatchObject({
      kind: AndroidAppLifecycleJobKind.Remove,
    });
    await jobs.removeForApplication('app-1');

    expect(records.size).toBe(0);
  });
});
