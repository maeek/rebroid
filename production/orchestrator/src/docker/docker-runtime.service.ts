import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { ApplicationProfileMode } from '../android-apps/application-profile-mode';
import { DockerEngineService } from './docker-engine.service';
import { DockerSidecarService } from './docker-sidecar.service';
import {
  ApplicationContainerSpec,
  ContainerRuntimeState,
  ManagedContainerResourceUsage,
  ServiceHealth,
  ViewerTargetStatus,
} from './docker.types';
import { parseCommandLine } from './docker.utils';
import {
  calculateContainerCpuUsagePercent,
  calculateContainerMemoryUsageBytes,
} from './utils/docker-runtime.utils';

@Injectable()
export class DockerRuntimeService {
  private readonly logger = new Logger(DockerRuntimeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly engine: DockerEngineService,
    private readonly sidecar: DockerSidecarService,
  ) {}

  async inspectContainer(containerId: string) {
    return this.engine.inspectContainer(containerId);
  }

  async getContainerRuntimeState(
    containerId: string,
  ): Promise<ContainerRuntimeState> {
    try {
      const inspect = await this.engine.inspectContainer(containerId);
      return {
        exists: true,
        running: Boolean(inspect.State?.Running),
        status: inspect.State?.Status ?? null,
        exitCode:
          typeof inspect.State?.ExitCode === 'number'
            ? inspect.State.ExitCode
            : null,
        error: inspect.State?.Error || null,
        finishedAt: inspect.State?.FinishedAt || null,
      };
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) {
        return {
          exists: false,
          running: false,
          status: null,
          exitCode: null,
          error: null,
          finishedAt: null,
        };
      }

      throw error;
    }
  }

  async getContainerLogs(containerId: string, tail = 300) {
    return this.engine.getContainerLogs(containerId, tail);
  }

  async imageExists(image: string) {
    return this.engine.imageExists(image);
  }

  async ensureImage(image: string) {
    if (await this.engine.imageExists(image)) {
      return;
    }

    throw new ConflictException(
      `Docker image "${image}" is not available locally. Pull it before provisioning.`,
    );
  }

  async pullImage(image: string, onProgress?: (message: string) => void) {
    const stream = await this.engine.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.engine.docker.modem.followProgress(
        stream,
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
        (event) => {
          if (!onProgress) {
            return;
          }

          const parts = [event.status, event.progress, event.id].filter(Boolean);
          onProgress(parts.join(' '));
        },
      );
    });
  }

  async listImages() {
    return this.engine.docker.listImages();
  }

  async removeImage(image: string, force = false) {
    return this.engine.docker.getImage(image).remove({ force });
  }

  async createIsolatedNetwork(applicationId: string, networkName: string) {
    const existing = await this.findNetworkByName(networkName);
    if (existing) {
      return existing;
    }

    return this.engine.docker.createNetwork({
      Name: networkName,
      Internal: !this.config.getOrThrow<boolean>('app.docker.iptablesEnabled'),
      CheckDuplicate: true,
      Labels: this.engine.labels(applicationId, 'network'),
    });
  }

  async createVolume(applicationId: string, volumeName: string) {
    const existing = await this.findVolumeByName(volumeName);
    if (existing) {
      return existing;
    }

    return this.engine.docker.createVolume({
      Name: volumeName,
      Labels: this.engine.labels(applicationId, 'volume'),
    });
  }

  async connectOrchestratorToNetwork(networkName: string) {
    if (!this.engine.orchestratorContainerId) {
      this.logger.warn(
        `ORCHESTRATOR_CONTAINER_ID is not set; scrcpy proxying requires another path to reach ${networkName}.`,
      );
      return;
    }

    await this.engine.connectContainerToNetwork(
      this.engine.orchestratorContainerId,
      networkName,
    );
  }

  async prepareWsScrcpyViewerTarget(
    networkName: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus> {
    return this.sidecar.prepareViewerTarget(networkName, adbHost, adbPort);
  }

  async ensureWsScrcpySidecarOnNetwork(
    networkName: string,
  ): Promise<ViewerTargetStatus> {
    return this.sidecar.ensureSidecarOnNetwork(networkName);
  }

  async connectWsScrcpyAdb(
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus> {
    return this.sidecar.connectAdb(adbHost, adbPort);
  }

  async getWsScrcpyContainerIp(networkName: string) {
    return this.sidecar.getSidecarIp(networkName);
  }

  async wsScrcpyHealth(): Promise<ServiceHealth> {
    return this.sidecar.health();
  }

  async repairWsScrcpySidecar() {
    return this.sidecar.repair();
  }

  async createApplicationContainer(spec: ApplicationContainerSpec) {
    await this.ensureImage(spec.image);

    const existing = await this.engine.findContainerByName(spec.containerName);
    if (existing) {
      return this.engine.docker.getContainer(existing.Id);
    }

    const hostConfig: Dockerode.HostConfig = {
      NetworkMode: spec.networkName,
      Privileged: spec.privileged,
      PublishAllPorts: false,
      AutoRemove: false,
      RestartPolicy: {
        Name: 'no',
      },
    };

    if (spec.profileMode === ApplicationProfileMode.Persistent) {
      hostConfig.Mounts = [
        {
          Type: 'volume',
          Source: spec.volumeName,
          Target: spec.dataMountPath,
        },
      ];
    }

    if (spec.memoryLimitMb) {
      hostConfig.Memory = spec.memoryLimitMb * 1024 * 1024;
    }

    if (spec.cpuLimitCpus) {
      hostConfig.NanoCpus = Math.trunc(spec.cpuLimitCpus * 1_000_000_000);
    }

    return this.engine.docker.createContainer({
      Image: spec.image,
      name: spec.containerName,
      Cmd: parseCommandLine(spec.containerArgs),
      Env: [`ADB_TCP_PORT=${spec.adbPort}`],
      ExposedPorts: {
        [`${spec.adbPort}/tcp`]: {},
      },
      Labels: this.engine.labels(spec.applicationId, 'runtime'),
      HostConfig: hostConfig,
      NetworkingConfig: {
        EndpointsConfig: {
          [spec.networkName]: {},
        },
      },
    });
  }

  async startContainer(containerId: string) {
    await this.engine.startContainer(containerId);
  }

  async stopContainer(containerId: string, timeoutSeconds = 10) {
    await this.engine.stopContainer(containerId, timeoutSeconds);
  }

  async removeContainer(containerId: string) {
    await this.engine.removeContainer(containerId);
  }

  async removeContainerByName(containerName: string) {
    const existing = await this.engine.findContainerByName(containerName);
    if (!existing) {
      return;
    }

    await this.engine.removeContainer(existing.Id);
  }

  async removeNetwork(networkName: string) {
    await this.engine.removeNetwork(networkName);
  }

  async removeVolume(volumeName: string) {
    await this.engine.removeVolume(volumeName);
  }

  async copyFileToContainer(
    containerId: string,
    sourcePath: string,
    targetDirectory: string,
    targetFileName?: string,
  ) {
    await this.engine.copyFileToContainer(
      containerId,
      sourcePath,
      targetDirectory,
      targetFileName,
    );
  }

  async execInContainer(containerId: string, command: string[]) {
    await this.engine.execInContainer(containerId, command);
  }

  async execInContainerWithOutput(containerId: string, command: string[]) {
    return this.engine.execInContainerWithOutput(containerId, command);
  }

  async getContainerIp(containerId: string, networkName: string) {
    const inspect = await this.engine.inspectContainer(containerId);
    return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
  }

  async getNetworkGateway(networkName: string) {
    const network = await this.engine.docker.getNetwork(networkName).inspect();
    return network.IPAM?.Config?.find((item) => item.Gateway)?.Gateway ?? null;
  }

  async getOrchestratorIp(networkName: string) {
    if (!this.engine.orchestratorContainerId) {
      return null;
    }

    try {
      const inspect = await this.engine.inspectContainer(
        this.engine.orchestratorContainerId,
      );
      return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
    } catch {
      return null;
    }
  }

  async listManagedContainers() {
    return this.engine.docker.listContainers({
      all: true,
      filters: {
        label: ['com.shop-me-alone.managed=true'],
      },
    });
  }

  async getManagedContainerResourceUsage(
    containers?: Dockerode.ContainerInfo[],
  ) {
    const managedContainers = containers ?? (await this.listManagedContainers());
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

  async systemDf() {
    return this.engine.docker.df();
  }

  private async findNetworkByName(name: string) {
    const networks = await this.engine.docker.listNetworks({
      filters: { name: [name] },
    });
    const network = networks.find((item) => item.Name === name);
    return network ? this.engine.docker.getNetwork(network.Id) : undefined;
  }

  private async findVolumeByName(name: string) {
    const volumes = await this.engine.docker.listVolumes({
      filters: { name: [name] },
    });
    const volume = volumes.Volumes?.find((item) => item.Name === name);
    return volume ? this.engine.docker.getVolume(volume.Name) : undefined;
  }
}