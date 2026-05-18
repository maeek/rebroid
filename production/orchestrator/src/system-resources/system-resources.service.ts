import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../common/error-message';
import { DockerRuntimeService } from '../docker/docker-runtime.service';

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
  private readonly logger = new Logger(SystemResourcesService.name);
  private volumeCache: VolumeUsageCache | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly docker: DockerRuntimeService,
  ) {}

  /**
   * Aggregates managed container counts, live resource usage, and cached volume sizes.
   */
  async getUsage(refreshVolumes = false) {
    const containers = await this.docker.listManagedContainers();
    const volumes = await this.getVolumeUsage(refreshVolumes);
    const running = containers.filter(
      (container) => container.State === 'running',
    ).length;
    const managedContainerResourceUsage =
      await this.getManagedContainerResourceUsage(containers);

    return {
      containersTotal: containers.length,
      containersRunning: running,
      containersStopped: containers.length - running,
      managedContainersCpuUsagePercent:
        managedContainerResourceUsage.cpuUsagePercent,
      managedContainersMemoryUsageBytes:
        managedContainerResourceUsage.memoryUsageBytes,
      containerStatsCollectedAt: new Date().toISOString(),
      managedVolumesTotal: volumes.length,
      managedVolumesSizeBytes: volumes.reduce(
        (sum: number, volume) => sum + (volume.sizeBytes ?? 0),
        0,
      ),
      volumeUsageCachedAt: this.volumeCache?.cachedAt.toISOString() ?? null,
      containers: containers.map((container) => ({
        id: container.Id,
        name:
          container.Names[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12),
        state: container.State,
        status: container.Status,
      })),
      volumes,
    };
  }

  /**
   * Falls back to zeroed stats when Docker refuses runtime metrics collection.
   */
  private async getManagedContainerResourceUsage(
    containers: Awaited<ReturnType<DockerRuntimeService['listManagedContainers']>>,
  ) {
    try {
      return await this.docker.getManagedContainerResourceUsage(containers);
    } catch (error) {
      this.logger.warn(
        `Unable to collect managed container stats: ${getErrorMessage(error)}`,
      );
      return {
        cpuUsagePercent: 0,
        memoryUsageBytes: 0,
      };
    }
  }

  /**
   * Caches managed volume usage for a configurable TTL because docker df can be expensive.
   */
  private async getVolumeUsage(refreshVolumes: boolean) {
    const ttlSeconds = this.config.getOrThrow<number>(
      'app.docker.volumeUsageCacheTtlSeconds',
    );
    const cacheIsFresh =
      this.volumeCache &&
      Date.now() - this.volumeCache.cachedAt.getTime() < ttlSeconds * 1000;

    if (!refreshVolumes && cacheIsFresh && this.volumeCache) {
      return this.volumeCache.volumes;
    }

    const df = await this.docker.systemDf();
    const dockerVolumes = (df.Volumes ?? []) as DockerVolumeDf[];
    const volumes = dockerVolumes
      .filter(
        (volume: DockerVolumeDf) =>
          volume.Labels?.['com.rebroid.managed'] === 'true',
      )
      .map((volume: DockerVolumeDf) => ({
        name: volume.Name,
        sizeBytes: volume.UsageData?.Size ?? null,
      }));

    this.volumeCache = { cachedAt: new Date(), volumes };
    return volumes;
  }
}
