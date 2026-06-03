import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import { DockerEngineService } from '../../docker-engine.service';
import {
  ContainerResourceUsage,
  ManagedContainerResourceUsage,
} from '../../docker.types';
import {
  calculateContainerCpuUsagePercent,
  calculateContainerMemoryUsageBytes,
  calculateContainerNetworkUsageBytes,
} from '../../utils/docker-runtime.utils';

@Injectable()
export class DockerResourceRuntimeService {
  constructor(private readonly engine: DockerEngineService) {}

  get hasPendingDockerWork() {
    return this.engine.hasPendingDockerWork;
  }

  async engineSummary() {
    const info = await this.engine.info();
    return {
      id: info.ID,
      name: info.Name,
      serverVersion: info.ServerVersion,
      operatingSystem: info.OperatingSystem,
      dockerRootDir: info.DockerRootDir,
      cgroupVersion: info.CgroupVersion,
      cgroupDriver: info.CgroupDriver,
      securityOptions: info.SecurityOptions ?? [],
    };
  }

  async hostCapacity() {
    const info = await this.engine.info();

    return {
      memoryBytes: typeof info.MemTotal === 'number' ? info.MemTotal : null,
      cpuCores: typeof info.NCPU === 'number' ? info.NCPU : null,
      dockerRootDir:
        typeof info.DockerRootDir === 'string' && info.DockerRootDir.trim()
          ? info.DockerRootDir
          : null,
    };
  }

  /**
   * Creates the persistent app volume if it does not exist already.
   */
  async createVolume(applicationId: string, volumeName: string) {
    const existing = await this.findVolumeByName(volumeName);
    if (existing) {
      return existing;
    }

    try {
      return await this.engine.mutate(
        () =>
          this.engine.docker.createVolume({
            Name: volumeName,
            Labels: this.engine.labels(applicationId, 'volume'),
          }),
        `Create volume ${volumeName}`,
      );
    } catch (error) {
      if (!this.engine.isResourceAlreadyExists(error)) {
        throw error;
      }

      const duplicate = await this.findVolumeByName(volumeName);
      if (duplicate) {
        return duplicate;
      }

      throw error;
    }
  }

  async removeVolume(volumeName: string) {
    try {
      await this.engine.mutate(
        () => this.engine.docker.getVolume(volumeName).remove(),
        `Remove volume ${volumeName}`,
      );
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async inspectVolume(volumeName: string) {
    try {
      return await this.engine.read(
        () => this.engine.docker.getVolume(volumeName).inspect(),
        `Inspect volume ${volumeName}`,
      );
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async listManagedContainers() {
    return this.engine.read(
      () =>
        this.engine.docker.listContainers({
          all: true,
          filters: {
            label: ['com.rebroid.managed=true'],
          },
        }),
      'List managed containers',
    );
  }

  async getContainerResourceUsage(
    containerId: string,
  ): Promise<ContainerResourceUsage> {
    const stats = await this.engine.read(
      () =>
        this.engine.docker.getContainer(containerId).stats({ stream: false }),
      `Collect resource usage for container ${containerId}`,
    );
    const networkUsage = calculateContainerNetworkUsageBytes(stats);

    return {
      cpuUsagePercent: calculateContainerCpuUsagePercent(stats),
      memoryUsageBytes: calculateContainerMemoryUsageBytes(stats),
      memoryLimitBytes: stats.memory_stats?.limit ?? null,
      networkRxBytes: networkUsage.rxBytes,
      networkTxBytes: networkUsage.txBytes,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregates CPU and memory usage across currently running managed containers.
   * Containers that disappear during stats collection are skipped.
   */
  async getManagedContainerResourceUsage(
    containers?: Dockerode.ContainerInfo[],
  ) {
    const managedContainers =
      containers ?? (await this.listManagedContainers());
    const runningContainers = managedContainers.filter(
      (container) => container.State === 'running',
    );

    const stats = await Promise.all(
      runningContainers.map(async (container) => {
        try {
          return await this.getContainerResourceUsage(container.Id);
        } catch (error) {
          if (this.engine.isDockerNotFound(error)) {
            return null;
          }

          throw error;
        }
      }),
    );

    return stats.reduce<ManagedContainerResourceUsage>(
      (totals, containerStats) => {
        if (!containerStats) {
          return totals;
        }

        return {
          cpuUsagePercent:
            totals.cpuUsagePercent + containerStats.cpuUsagePercent,
          memoryUsageBytes:
            totals.memoryUsageBytes + containerStats.memoryUsageBytes,
        };
      },
      {
        cpuUsagePercent: 0,
        memoryUsageBytes: 0,
      },
    );
  }

  private async findVolumeByName(name: string) {
    const volumes = await this.engine.read(
      () =>
        this.engine.docker.listVolumes({
          filters: { name: [name] },
        }),
      `List volumes while finding ${name}`,
    );
    const volume = volumes.Volumes?.find((item) => item.Name === name);
    return volume ? this.engine.docker.getVolume(volume.Name) : undefined;
  }
}
