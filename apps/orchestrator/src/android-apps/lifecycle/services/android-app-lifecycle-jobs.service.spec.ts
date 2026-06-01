import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';

describe('AndroidAppLifecycleJobsService', () => {
  const createRepository = () => {
    const records = new Map<string, Record<string, unknown>>();
    const key = (value: { applicationId: string; kind?: string }) =>
      `${value.applicationId}:${value.kind ?? '*'}`;
    const repository = {
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => {
        records.set(key(value), { ...value });
        return value;
      }),
      findOneBy: jest.fn(async (value) => records.get(key(value)) ?? null),
      delete: jest.fn(async (value) => {
        if (value.kind) {
          records.delete(key(value));
          return;
        }
        for (const recordKey of records.keys()) {
          if (recordKey.startsWith(`${value.applicationId}:`)) {
            records.delete(recordKey);
          }
        }
      }),
      find: jest.fn(async () => [...records.values()]),
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

    expect(records.get('app-1:install_apk')).toMatchObject({
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
    await jobs.removeForApplication('app-1');

    expect(records.size).toBe(0);
  });
});
