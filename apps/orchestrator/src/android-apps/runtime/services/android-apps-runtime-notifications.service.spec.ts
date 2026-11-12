import { ConfigService } from '@nestjs/config';
import type { DockerContainerLifecyclePort } from '../../../docker/contracts/docker-container-lifecycle.port';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';
import { AndroidAppsRuntimeNotificationsService } from './android-apps-runtime-notifications.service';

const exampleNotification =
  'NotificationRecord(pkg=com.example.test title=New message, text=Hello, channel=test)';
const noActiveNotifications = [
  'Current Notification Manager state:',
  ' mArchive=Archive (1 notification)',
  ' StatusBarNotification(pkg=com.example.test title=Old message, text=Hello)',
].join('\n');

function fixture({ appCount = 1, adbDelayMs = 0 } = {}) {
  const apps = Array.from({ length: appCount }, (_, index) =>
    Object.assign(new AndroidApplication(), {
      id: `app-${index}`,
      containerId: `container-${index}`,
      containerName: `runtime-${index}`,
      networkName: `network-${index}`,
      ownerUserId: 'owner',
      adbPort: 5555,
      profileName: 'default',
      lastStartedAt: new Date(0),
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.Ready,
    }),
  );
  const queries = {
    getStored: async (id: string) => ({
      ...apps.find((app) => app.id === id)!,
    }),
  };
  const inspect = jest.fn(async () => ({
    exists: true,
    running: true,
    status: 'running',
    exitCode: null,
    oomKilled: false,
    error: null,
    finishedAt: null,
  }));
  const lifecycle = {
    getContainerRuntimeState: inspect,
  } satisfies Pick<DockerContainerLifecyclePort, 'getContainerRuntimeState'>;
  const tracker = new AndroidAppsProvisioningTrackerService();
  const reconciler = new AndroidAppsRuntimeStateReconciler(
    new ConfigService(),
    lifecycle as unknown as DockerContainerLifecyclePort,
    {} as never,
    { decorateApplication: (app: AndroidApplication) => app } as never,
    queries as never,
    {} as never,
    tracker,
  );
  const sidecar = new AndroidAppsSidecarAdbService(
    { getOrThrow: () => 'http://sidecar.test', get: () => undefined } as never,
    {
      requireViewerTarget: async (app: AndroidApplication) => ({
        udid: app.containerName,
      }),
      invalidateViewerTarget: jest.fn(),
    } as never,
  );
  const android = { output: exampleNotification };
  const dump = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const { output } = android;
    if (adbDelayMs)
      await new Promise((resolve) => setTimeout(resolve, adbDelayMs));
    return Response.json({ output });
  });
  const sampler = new AndroidAppsRuntimeNotificationsService(
    queries as never,
    reconciler,
    sidecar,
    tracker,
  );
  return {
    apps,
    sampler,
    inspect,
    dump,
    android,
    reconciler,
    sidecar,
    tracker,
  };
}

describe('shared Android notification sampling', () => {
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('halves Docker inspections and ADB dump requests for three staggered clients and eight apps', async () => {
    const { apps, sampler, inspect, dump, reconciler, sidecar } = fixture({
      appCount: 8,
    });
    const times = Array.from({ length: 6 }, (_, cycle) =>
      [0, 3_000, 6_000].map((offset) => cycle * 10_000 + offset),
    ).flat();
    for (const time of times) {
      jest.setSystemTime(time);
      await Promise.all(
        apps.map(async ({ id }) =>
          sidecar.notifications(await reconciler.reconcileById(id)),
        ),
      );
    }
    expect(inspect).toHaveBeenCalledTimes(144);
    expect(dump).toHaveBeenCalledTimes(144);
    inspect.mockClear();
    dump.mockClear();

    jest.setSystemTime(60_000);
    let elapsed = 0;
    for (const time of times) {
      await jest.advanceTimersByTimeAsync(time - elapsed);
      elapsed = time;
      await Promise.all(apps.map(({ id }) => sampler.list(id)));
    }
    expect(inspect).toHaveBeenCalledTimes(72);
    expect(dump).toHaveBeenCalledTimes(72);
  });

  it('shares an in-flight refresh and reuses a successful empty result', async () => {
    const {
      apps: [app],
      sampler,
      inspect,
      dump,
      android,
    } = fixture();
    android.output = '';
    await expect(
      Promise.all([sampler.list(app.id), sampler.list(app.id)]),
    ).resolves.toEqual([[], []]);
    await jest.advanceTimersByTimeAsync(4_999);
    await expect(sampler.list(app.id)).resolves.toEqual([]);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(dump).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await sampler.list(app.id);
    expect(dump).toHaveBeenCalledTimes(2);
  });

  it('does not serve a cached result while Stop is draining runtime work', async () => {
    const {
      apps: [app],
      sampler,
      inspect,
      dump,
      tracker,
    } = fixture();
    await expect(sampler.list(app.id)).resolves.toHaveLength(1);
    tracker.cancel(app.id);
    await expect(sampler.list(app.id)).resolves.toEqual([]);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(dump).toHaveBeenCalledTimes(1);
  });

  it('discards a late result after a managed restart reuses the same container', async () => {
    const {
      apps: [app],
      sampler,
      dump,
    } = fixture({ adbDelayMs: 250 });
    const oldSample = sampler.list(app.id);
    await jest.advanceTimersByTimeAsync(10);
    expect(dump).toHaveBeenCalledTimes(1);
    app.lastStartedAt = new Date(10);
    await jest.advanceTimersByTimeAsync(250);
    await expect(oldSample).resolves.toEqual([]);

    const newSample = sampler.list(app.id);
    await jest.advanceTimersByTimeAsync(250);
    await expect(newSample).resolves.toHaveLength(1);
    expect(dump).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed dump as an empty list', async () => {
    const {
      apps: [app],
      sampler,
      dump,
    } = fixture();
    dump.mockResolvedValueOnce(
      Response.json({ message: 'Unavailable' }, { status: 503 }),
    );
    await expect(sampler.list(app.id)).rejects.toThrow('Unavailable');
    await expect(sampler.list(app.id)).resolves.toHaveLength(1);
    expect(dump).toHaveBeenCalledTimes(2);
  });

  it('limits concurrent Android work across unrelated runtimes', async () => {
    const { apps, sampler, inspect, dump } = fixture({
      appCount: 8,
      adbDelayMs: 250,
    });
    const results = Promise.all(apps.map(({ id }) => sampler.list(id)));
    await jest.advanceTimersByTimeAsync(1);
    expect(inspect).toHaveBeenCalledTimes(4);
    expect(dump).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(500);
    await expect(results).resolves.toHaveLength(8);
    expect(dump).toHaveBeenCalledTimes(8);
  });

  it('times out all waiters and releases the runtime after late work settles', async () => {
    const {
      apps: [app],
      sampler,
      dump,
    } = fixture({ adbDelayMs: 250 });
    const deadline = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(deadline.signal);
    const first = expect(sampler.list(app.id)).rejects.toMatchObject({
      status: 504,
    });
    const joined = expect(sampler.list(app.id)).rejects.toMatchObject({
      status: 504,
    });
    await jest.advanceTimersByTimeAsync(1);
    deadline.abort();
    await Promise.all([first, joined]);
    expect(dump).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(250);
    const retry = sampler.list(app.id);
    await jest.advanceTimersByTimeAsync(250);
    await expect(retry).resolves.toHaveLength(1);
    expect(dump).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])(
    'updates p95 badge input within 15 seconds when notification presence becomes %s',
    async (appears) => {
      const delays: number[] = [];
      for (let phase = 100; phase < 10_000; phase += 500) {
        const { apps, sampler, android } = fixture({
          appCount: 8,
          adbDelayMs: 250,
        });
        android.output = appears ? noActiveNotifications : exampleNotification;
        const changedAt = Date.now() + 10_000 + phase;
        setTimeout(() => {
          android.output = appears
            ? exampleNotification
            : noActiveNotifications;
        }, 10_000 + phase);
        const firstUpdate = new Map<number, number>();
        const polls = [0, 3_000, 6_000].flatMap((offset) =>
          Array.from(
            { length: 4 },
            (_, cycle) =>
              new Promise<void>((resolve, reject) => {
                setTimeout(
                  () => {
                    void Promise.all(
                      apps.map(({ id }) => sampler.list(id)),
                    ).then((notifications) => {
                      if (
                        Date.now() >= changedAt &&
                        notifications.every(
                          (list) => Boolean(list.length) === appears,
                        ) &&
                        !firstUpdate.has(offset)
                      ) {
                        firstUpdate.set(offset, Date.now() - changedAt);
                      }
                      resolve();
                    }, reject);
                  },
                  cycle * 10_000 + offset,
                );
              }),
          ),
        );
        await jest.advanceTimersByTimeAsync(37_000);
        await Promise.all(polls);
        expect(firstUpdate.size).toBe(3);
        delays.push(...firstUpdate.values());
      }
      delays.sort((left, right) => left - right);
      expect(delays[Math.ceil(delays.length * 0.95) - 1]).toBeLessThanOrEqual(
        15_000,
      );
    },
  );
});
