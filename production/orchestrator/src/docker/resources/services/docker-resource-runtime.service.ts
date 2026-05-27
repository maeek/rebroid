import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import { DockerEngineService } from '../../docker-engine.service';
import { ManagedContainerResourceUsage } from '../../docker.types';
import {
  calculateContainerCpuUsagePercent,
  calculateContainerMemoryUsageBytes,
} from '../../utils/docker-runtime.utils';

@Injectable()
export class DockerResourceRuntimeService {
  constructor(private readonly engine: DockerEngineService) {}

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
      return await this.engine.docker.createVolume({
        Name: volumeName,
        Labels: this.engine.labels(applicationId, 'volume'),
      });
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
      await this.engine.docker.getVolume(volumeName).remove();
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async inspectVolume(volumeName: string) {
    try {
      return await this.engine.docker.getVolume(volumeName).inspect();
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async listManagedContainers() {
    return this.engine.docker.listContainers({
      all: true,
      filters: {
        label: ['com.rebroid.managed=true'],
      },
    });
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
          return await this.engine.docker
            .getContainer(container.Id)
            .stats({ stream: false });
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
            totals.cpuUsagePercent +
            calculateContainerCpuUsagePercent(containerStats),
          memoryUsageBytes:
            totals.memoryUsageBytes +
            calculateContainerMemoryUsageBytes(containerStats),
        };
      },
      {
        cpuUsagePercent: 0,
        memoryUsageBytes: 0,
      },
    );
  }

  /**
   * Returns Docker disk-usage data for callers that need volume sizing details.
   */
  async systemDf() {
    return this.engine.docker.df();
  }

  private async findVolumeByName(name: string) {
    const volumes = await this.engine.docker.listVolumes({
      filters: { name: [name] },
    });
    const volume = volumes.Volumes?.find((item) => item.Name === name);
    return volume ? this.engine.docker.getVolume(volume.Name) : undefined;
  }
}
