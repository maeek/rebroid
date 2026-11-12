import { SystemResourcesService } from '../../../system-resources/system-resources.service';
import type { DockerEngineService } from '../../docker-engine.service';
import { DockerInventoryService } from '../../inventory/docker-inventory.service';
import { DockerResourceRuntimeService } from './docker-resource-runtime.service';

describe('Docker resource inventory and stats', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shares container samples across staggered overviews and the container detail read', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T00:00:00.000Z') });
    const containers = Array.from({ length: 24 }, (_, i) => ({
      Id: i.toString(16).padStart(64, '0'),
      Names: [`/container-${i}`],
      State: 'running',
      Status: 'Up 1 minute',
    }));
    const info = jest.fn().mockResolvedValue({ NCPU: 4 });
    const listContainers = jest.fn().mockResolvedValue(containers);
    const stats = jest.fn().mockResolvedValue({ memory_stats: { usage: 4 } });
    const engine = {
      info,
      docker: { listContainers, getContainer: () => ({ stats }) },
      read: <T>(operation: () => Promise<T>) => operation(),
      readStats: <T>(operation: (signal: AbortSignal) => Promise<T>) =>
        operation(new AbortController().signal),
    } as unknown as DockerEngineService;
    const resources = new DockerResourceRuntimeService(
      engine,
      new DockerInventoryService(engine),
    );
    const service = new SystemResourcesService(resources);

    await Promise.all([
      service.getUsage(),
      resources.getContainerResourceUsage(containers[0].Id),
    ]);
    for (let i = 0; i < 4; i++) {
      await jest.advanceTimersByTimeAsync(1_000);
      await expect(service.getUsage()).resolves.toMatchObject({
        managedContainersMemoryUsageBytes: 96,
        containerStatsCollectedAt: '2026-10-01T00:00:00.000Z',
        containerStatsSampled: 24,
      });
    }
    expect(stats).toHaveBeenCalledTimes(24);
    expect(info).toHaveBeenCalledTimes(1);
    expect(listContainers).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_000);
    await expect(service.getUsage()).resolves.toMatchObject({
      containerStatsCollectedAt: '2026-10-01T00:00:05.000Z',
    });
    expect(stats).toHaveBeenCalledTimes(48);
    expect(listContainers).toHaveBeenCalledTimes(2);
  });

  it('returns the available usage and coverage when a sweep reaches its deadline', async () => {
    jest.useFakeTimers();
    jest.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const deadline = new AbortController();
      setTimeout(() => deadline.abort(), ms);
      return deadline.signal;
    });
    const containers = Array.from({ length: 10 }, (_, i) => ({
      Id: i.toString(16).padStart(64, '0'),
      Names: [],
      State: 'running',
      Status: 'running',
    }));
    let release!: (value: { memory_stats: { usage: number } }) => void;
    const blocked = new Promise<{ memory_stats: { usage: number } }>(
      (resolve) => {
        release = resolve;
      },
    );
    const stats = jest
      .fn()
      .mockReturnValue(blocked)
      .mockResolvedValueOnce({ memory_stats: { usage: 4 } });
    const engine = {
      info: async () => ({}),
      docker: {
        listContainers: async () => containers,
        getContainer: () => ({ stats }),
      },
      read: <T>(operation: () => Promise<T>) => operation(),
      readStats: <T>(operation: (signal: AbortSignal) => Promise<T>) =>
        operation(new AbortController().signal),
    } as unknown as DockerEngineService;
    const service = new SystemResourcesService(
      new DockerResourceRuntimeService(
        engine,
        new DockerInventoryService(engine),
      ),
    );

    const overview = service.getUsage();
    await jest.advanceTimersByTimeAsync(7_000);
    await expect(overview).resolves.toMatchObject({
      containersRunning: 10,
      containerStatsSampled: 1,
      managedContainersMemoryUsageBytes: 4,
    });
    expect(stats).toHaveBeenCalledTimes(5);
    release({ memory_stats: { usage: 4 } });
    await jest.advanceTimersByTimeAsync(0);
    expect(stats).toHaveBeenCalledTimes(5);
  });
});
