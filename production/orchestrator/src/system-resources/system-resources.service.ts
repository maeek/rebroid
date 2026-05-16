import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerService } from '../docker/docker.service';

interface VolumeUsageCache {
  cachedAt: Date;
  volumes: { name: string; sizeBytes: number | null }[];
}

interface DockerVolumeDf {
  Name: string;
  Labels?: Record<string, string>;
  UsageData?: {
    Size?: number;
  };
}

@Injectable()
export class SystemResourcesService {
  private volumeCache: VolumeUsageCache | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly docker: DockerService,
  ) {}

  async getUsage(refreshVolumes = false) {
    const containers = await this.docker.listManagedContainers();
    const volumes = await this.getVolumeUsage(refreshVolumes);
    const running = containers.filter((container) => container.State === 'running').length;
    const managedContainerResourceUsage =
      await this.docker.getManagedContainerResourceUsage(containers);

    return {
      containersTotal: containers.length,
      containersRunning: running,
      containersStopped: containers.length - running,
      managedContainersCpuUsagePercent: managedContainerResourceUsage.cpuUsagePercent,
      managedContainersMemoryUsageBytes: managedContainerResourceUsage.memoryUsageBytes,
      containerStatsCollectedAt: new Date().toISOString(),
      managedVolumesTotal: volumes.length,
      managedVolumesSizeBytes: volumes.reduce(
        (sum: number, volume) => sum + (volume.sizeBytes ?? 0),
        0,
      ),
      volumeUsageCachedAt: this.volumeCache?.cachedAt.toISOString() ?? null,
      containers: containers.map((container) => ({
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12),
        state: container.State,
        status: container.Status,
      })),
      volumes,
    };
  }

  private async getVolumeUsage(refreshVolumes: boolean) {
    const ttlSeconds = this.config.getOrThrow<number>('app.docker.volumeUsageCacheTtlSeconds');
    const cacheIsFresh =
      this.volumeCache &&
      Date.now() - this.volumeCache.cachedAt.getTime() < ttlSeconds * 1000;

    if (!refreshVolumes && cacheIsFresh && this.volumeCache) {
      return this.volumeCache.volumes;
    }

    const df = await this.docker.systemDf();
    const dockerVolumes = (df.Volumes ?? []) as DockerVolumeDf[];
    const volumes = dockerVolumes
      .filter((volume: DockerVolumeDf) => volume.Labels?.['com.shop-me-alone.managed'] === 'true')
      .map((volume: DockerVolumeDf) => ({
        name: volume.Name,
        sizeBytes: volume.UsageData?.Size ?? null,
      }));

    this.volumeCache = { cachedAt: new Date(), volumes };
    return volumes;
  }
}
