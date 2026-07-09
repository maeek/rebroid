import { Inject, Injectable, Logger } from '@nestjs/common';
import { statfs } from 'node:fs/promises';
import { getErrorMessage } from '../common/error-message';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../docker/contracts/docker-resource-runtime.port';

@Injectable()
export class SystemResourcesService {
  private readonly logger = new Logger(SystemResourcesService.name);
  private usageRequest: Promise<
    Awaited<ReturnType<SystemResourcesService['collectUsage']>>
  > | null = null;
  private dockerRootStatfsWarningShown = false;

  constructor(
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly docker: DockerResourceRuntimePort,
  ) {}

  /**
   * Aggregates managed container counts and live resource usage.
   */
  async getUsage() {
    if (this.usageRequest) {
      return this.usageRequest;
    }

    const pending = this.collectUsage().finally(() => {
      if (this.usageRequest === pending) {
        this.usageRequest = null;
      }
    });
    this.usageRequest = pending;
    return pending;
  }

  private async collectUsage() {
    const [hostCapacity, containers] = await Promise.all([
      this.docker.hostCapacity(),
      this.docker.listManagedContainers(),
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
      containers: containers.map((container) => ({
        id: container.Id,
        name:
          container.Names[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12),
        state: container.State,
        status: container.Status,
      })),
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
      ReturnType<DockerResourceRuntimePort['listManagedContainers']>
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
}
