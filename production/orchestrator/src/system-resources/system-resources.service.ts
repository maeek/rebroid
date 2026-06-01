import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { statfs } from 'node:fs/promises';
import { getErrorMessage } from '../common/error-message';
import { DockerResourceRuntimeService } from '../docker/resources/services/docker-resource-runtime.service';

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
  private volumeUsageRequest: Promise<VolumeUsageCache['volumes']> | null = null;
  private volumeUsageRetryAfter = 0;
  private usageRequest: Promise<
    Awaited<ReturnType<SystemResourcesService['collectUsage']>>
  > | null = null;
  private dockerRootStatfsWarningShown = false;

  constructor(
    private readonly config: ConfigService,
    private readonly docker: DockerResourceRuntimeService,
  ) {}

  /**
   * Aggregates managed container counts, live resource usage, and cached volume sizes.
   */
  async getUsage(refreshVolumes = false) {
    if (this.usageRequest) {
      return this.usageRequest;
    }

    const pending = this.collectUsage(refreshVolumes).finally(() => {
      if (this.usageRequest === pending) {
        this.usageRequest = null;
      }
    });
    this.usageRequest = pending;
    return pending;
  }

  private async collectUsage(refreshVolumes: boolean) {
    const [hostCapacity, containers, volumes] = await Promise.all([
      this.docker.hostCapacity(),
      this.docker.listManagedContainers(),
      this.getVolumeUsage(refreshVolumes),
    ]);
    const running = containers.filter(
      (container) => container.State === 'running',
    ).length;
    const [managedContainerResourceUsage, dockerRootAvailableBytes] =
      await Promise.all([
        this.getManagedContainerResourceUsage(containers),
        this.getAvailableBytes(hostCapacity.dockerRootDir),
      ]);

    return {
      hostMemoryBytes: hostCapacity.memoryBytes,
      hostCpuCores: hostCapacity.cpuCores,
      dockerRootAvailableBytes,
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

  async getCapacity() {
    const hostCapacity = await this.docker.hostCapacity();

    return {
      hostMemoryBytes: hostCapacity.memoryBytes,
      hostCpuCores: hostCapacity.cpuCores,
    };
  }

  private async getAvailableBytes(path: string | null) {
    if (!path) {
      return null;
    }

    try {
      const stats = await statfs(path);
      return stats.bavail * stats.bsize;
    } catch (error) {
      if (!this.dockerRootStatfsWarningShown) {
        this.dockerRootStatfsWarningShown = true;
        this.logger.warn(
          `Unable to collect available Docker root storage: ${getErrorMessage(error)}`,
        );
      }
      return null;
    }
  }

  /**
   * Falls back to zeroed stats when Docker refuses runtime metrics collection.
   */
  private async getManagedContainerResourceUsage(
    containers: Awaited<
      ReturnType<DockerResourceRuntimeService['listManagedContainers']>
    >,
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

    if (
      this.docker.hasPendingMutations ||
      Date.now() < this.volumeUsageRetryAfter
    ) {
      return this.volumeCache?.volumes ?? [];
    }

    if (this.volumeUsageRequest) {
      return this.volumeUsageRequest;
    }

    const pending = this.collectVolumeUsage().finally(() => {
      if (this.volumeUsageRequest === pending) {
        this.volumeUsageRequest = null;
      }
    });
    this.volumeUsageRequest = pending;
    return pending;
  }

  private async collectVolumeUsage() {
    let df: Awaited<ReturnType<DockerResourceRuntimeService['systemDf']>>;
    try {
      df = await this.docker.systemDf();
    } catch (error) {
      const retryDelaySeconds = this.config.getOrThrow<number>(
        'app.docker.volumeUsageRetryDelaySeconds',
      );
      this.volumeUsageRetryAfter = Date.now() + retryDelaySeconds * 1000;
      this.logger.warn(
        `Unable to collect managed volume usage: ${getErrorMessage(error)}`,
      );
      return this.volumeCache?.volumes ?? [];
    }

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
    this.volumeUsageRetryAfter = 0;
    return volumes;
  }
}
