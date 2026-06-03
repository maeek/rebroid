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
  }),
};

describe('SystemResourcesService', () => {
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
    });
  });
});
