import { SystemResourcesService } from '../../../system-resources/system-resources.service';
import type { DockerEngineService } from '../../docker-engine.service';
import { DockerInventoryService } from '../../inventory/docker-inventory.service';
import { DockerResourceRuntimeService } from './docker-resource-runtime.service';

describe('Docker resource inventory and stats', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shares host capacity across resource endpoints and refreshes container samples independently', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T00:00:00.000Z') });
    const containers = Array.from({ length: 24 }, (_, i) => ({
      Id: i.toString(16).padStart(64, '0'),
      Names: [`/container-${i}`],
      State: 'running',
      Status: 'Up 1 minute',
    }));
    const info = jest
      .fn()
      .mockResolvedValue({ NCPU: 4, MemTotal: 8 * 1024 ** 3 });
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
      expect(service.getCapacity()).resolves.toEqual({
        hostCpuCores: 4,
        hostMemoryBytes: 8 * 1024 ** 3,
      }),
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

    await jest.advanceTimersByTimeAsync(60_000);
    await expect(service.getUsage()).resolves.toMatchObject({
      hostCpuCores: 4,
      hostMemoryBytes: 8 * 1024 ** 3,
      containerStatsCollectedAt: '2026-10-01T00:01:05.000Z',
    });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('retries host capacity when the initial Docker read fails', async () => {
    const info = jest
      .fn()
      .mockRejectedValueOnce(new Error('Docker unavailable'))
      .mockResolvedValue({ NCPU: 4 });
    const engine = { info } as unknown as DockerEngineService;
    const resources = new DockerResourceRuntimeService(
      engine,
      new DockerInventoryService(engine),
    );

    await expect(resources.hostCapacity()).rejects.toThrow(
      'Docker unavailable',
    );
    await expect(resources.hostCapacity()).resolves.toMatchObject({
      cpuCores: 4,
    });
    await expect(resources.hostCapacity()).resolves.toMatchObject({
      cpuCores: 4,
    });
    expect(info).toHaveBeenCalledTimes(2);
  });

  it('gives unvisited responsive containers priority after a sweep full of timeouts', async () => {
    jest.useFakeTimers();
    jest.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const deadline = new AbortController();
      setTimeout(() => deadline.abort(), ms);
      return deadline.signal;
    });
    const containers = Array.from({ length: 12 }, (_, i) => ({
      id: i.toString(16).padStart(64, '0'),
      name: String(i),
      state: 'running',
      status: 'Up',
    }));
    const visited: string[] = [];
    const engine = {
      docker: {
        getContainer: (id: string) => ({
          stats: () => {
            visited.push(id);
            if (Number.parseInt(id, 16) >= 8)
              return Promise.resolve({ memory_stats: { usage: 4 } });
            return new Promise((_, reject) =>
              setTimeout(() => reject(new Error('deadline')), 4_000),
            );
          },
        }),
      },
      readStats: <T>(operation: (signal: AbortSignal) => Promise<T>) =>
        operation(new AbortController().signal),
    } as unknown as DockerEngineService;
    const resources = new DockerResourceRuntimeService(
      engine,
      new DockerInventoryService(engine),
    );
    const first = resources.getManagedContainerResourceUsage(containers);
    await jest.advanceTimersByTimeAsync(8_000);
    await expect(first).resolves.toMatchObject({ sampledContainers: 0 });
    expect(visited).toHaveLength(8);

    const second = resources.getManagedContainerResourceUsage(containers);
    await jest.advanceTimersByTimeAsync(8_000);
    await expect(second).resolves.toMatchObject({ sampledContainers: 4 });
    expect(visited.slice(8, 12)).toEqual(
      containers.slice(8).map(({ id }) => id),
    );
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
