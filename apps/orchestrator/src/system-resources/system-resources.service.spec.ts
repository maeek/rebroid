import { ConfigService } from '@nestjs/config';
import { DockerResourceRuntimeService } from '../docker/resources/services/docker-resource-runtime.service';
import { SystemResourcesService } from './system-resources.service';

const createService = (
  docker: Partial<DockerResourceRuntimeService>,
): SystemResourcesService =>
  new SystemResourcesService(
    {
      getOrThrow: (key: string) => {
        if (
          key === 'app.docker.volumeUsageCacheTtlSeconds' ||
          key === 'app.docker.volumeUsageRetryDelaySeconds'
        ) {
          return key === 'app.docker.volumeUsageCacheTtlSeconds' ? 300 : 60;
        }

        throw new Error(`Unexpected config key: ${key}`);
      },
    } as unknown as ConfigService,
    docker as DockerResourceRuntimeService,
  );

const baseDocker = {
  hasPendingDockerWork: false,
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
  it('returns the remaining resource data when Docker volume usage cannot be collected', async () => {
    const service = createService({
      ...baseDocker,
      systemDf: jest.fn().mockRejectedValue(new Error('docker df failed')),
    });

    await expect(service.getUsage()).resolves.toMatchObject({
      containersTotal: 0,
      managedVolumesTotal: 0,
      managedVolumesSizeBytes: 0,
      volumes: [],
    });
  });

  it('reuses cached volume usage when a forced refresh fails', async () => {
    const systemDf = jest
      .fn()
      .mockResolvedValueOnce({
        Volumes: [
          {
            Name: 'managed-volume',
            Labels: { 'com.rebroid.managed': 'true' },
            UsageData: { Size: 512 },
          },
        ],
      })
      .mockRejectedValueOnce(new Error('docker df failed'));
    const service = createService({ ...baseDocker, systemDf });

    await service.getUsage();

    await expect(service.getUsage(true)).resolves.toMatchObject({
      managedVolumesTotal: 1,
      managedVolumesSizeBytes: 512,
      volumes: [{ name: 'managed-volume', sizeBytes: 512 }],
    });
  });

  it('coalesces concurrent resource snapshots and Docker df requests', async () => {
    let resolveDf!: (value: { Volumes: [] }) => void;
    const dfGate = new Promise<{ Volumes: [] }>((resolve) => {
      resolveDf = resolve;
    });
    const systemDf = jest.fn().mockReturnValue(dfGate);
    const service = createService({ ...baseDocker, systemDf });

    const first = service.getUsage();
    const second = service.getUsage();
    await Promise.resolve();

    expect(systemDf).toHaveBeenCalledTimes(1);

    resolveDf({ Volumes: [] });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('waits for the retry cooldown before repeating a failed Docker df request', async () => {
    const systemDf = jest.fn().mockRejectedValue(new Error('docker df failed'));
    const service = createService({ ...baseDocker, systemDf });

    await service.getUsage();
    await service.getUsage(true);

    expect(systemDf).toHaveBeenCalledTimes(1);
  });

  it('serves stale volume usage while a Docker mutation is pending', async () => {
    const docker = {
      ...baseDocker,
      hasPendingDockerWork: false,
      systemDf: jest.fn().mockResolvedValue({
        Volumes: [
          {
            Name: 'managed-volume',
            Labels: { 'com.rebroid.managed': 'true' },
            UsageData: { Size: 512 },
          },
        ],
      }),
    };
    const service = createService(docker);

    await service.getUsage();
    docker.hasPendingDockerWork = true;

    await expect(service.getUsage(true)).resolves.toMatchObject({
      volumes: [{ name: 'managed-volume', sizeBytes: 512 }],
    });
    expect(docker.systemDf).toHaveBeenCalledTimes(1);
  });
});
