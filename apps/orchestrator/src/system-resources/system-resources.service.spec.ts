import type { DockerEngineService } from '../docker/docker-engine.service';
import { DockerResourceRuntimeService } from '../docker/resources/services/docker-resource-runtime.service';
import { SystemResourcesService } from './system-resources.service';

const createService = (
  docker: Partial<DockerResourceRuntimeService>,
): SystemResourcesService =>
  new SystemResourcesService(docker as DockerResourceRuntimeService);

const baseDocker = {
  hostCapacity: jest.fn().mockResolvedValue({
    memoryBytes: 1024,
    cpuCores: 2,
    dockerRootDir: null,
  }),
  listManagedContainers: jest.fn().mockResolvedValue([]),
  getManagedContainerResourceUsage: jest.fn().mockResolvedValue({
    cpuUsagePercent: 0,
    memoryUsageBytes: 0,
    collectedAt: null,
    sampledContainers: 0,
  }),
};

describe('SystemResourcesService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('returns managed container counts and resource usage without Docker df', async () => {
    const service = createService({
      ...baseDocker,
      listManagedContainers: jest.fn().mockResolvedValue([
        {
          Id: 'running-container-id',
          Names: ['/rebroid-running'],
          State: 'running',
          Status: 'Up 1 minute',
        },
        {
          Id: 'stopped-container-id',
          Names: ['/rebroid-stopped'],
          State: 'exited',
          Status: 'Exited',
        },
      ]),
      getManagedContainerResourceUsage: jest.fn().mockResolvedValue({
        cpuUsagePercent: 12.5,
        memoryUsageBytes: 256,
        collectedAt: '2026-10-01T00:00:00.000Z',
        sampledContainers: 1,
      }),
    });

    await expect(service.getUsage()).resolves.toMatchObject({
      hostMemoryBytes: 1024,
      hostCpuCores: 2,
      containersTotal: 2,
      containersRunning: 1,
      containersStopped: 1,
      managedContainersCpuUsagePercent: 12.5,
      managedContainersMemoryUsageBytes: 256,
      containerStatsCollectedAt: '2026-10-01T00:00:00.000Z',
      containerStatsSampled: 1,
      containers: [
        {
          id: 'running-container-id',
          name: 'rebroid-running',
          state: 'running',
          status: 'Up 1 minute',
        },
        {
          id: 'stopped-container-id',
          name: 'rebroid-stopped',
          state: 'exited',
          status: 'Exited',
        },
      ],
    });
  });

  it('coalesces concurrent resource snapshots', async () => {
    let resolveContainers!: (value: []) => void;
    const containersGate = new Promise<[]>((resolve) => {
      resolveContainers = resolve;
    });
    const docker = {
      ...baseDocker,
      listManagedContainers: jest.fn().mockReturnValue(containersGate),
    };
    const service = createService(docker);

    const first = service.getUsage();
    const second = service.getUsage();
    await Promise.resolve();

    expect(docker.listManagedContainers).toHaveBeenCalledTimes(1);

    resolveContainers([]);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('falls back to zeroed live stats when Docker stats collection fails', async () => {
    const service = createService({
      ...baseDocker,
      getManagedContainerResourceUsage: jest
        .fn()
        .mockRejectedValue(new Error('stats failed')),
    });

    await expect(service.getUsage()).resolves.toMatchObject({
      managedContainersCpuUsagePercent: 0,
      managedContainersMemoryUsageBytes: 0,
      containerStatsCollectedAt: null,
      containerStatsSampled: 0,
    });
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
    const resources = new DockerResourceRuntimeService(engine);
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
    expect(listContainers).toHaveBeenCalledTimes(5);

    await jest.advanceTimersByTimeAsync(1_000);
    await expect(service.getUsage()).resolves.toMatchObject({
      containerStatsCollectedAt: '2026-10-01T00:00:05.000Z',
    });
    expect(stats).toHaveBeenCalledTimes(48);
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
      new DockerResourceRuntimeService(engine),
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
