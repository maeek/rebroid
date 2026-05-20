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

  /**
   * Returns a simplified runtime snapshot and turns Docker 404s into exists=false.
   */
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

  /**
   * Fails fast when a required image is missing instead of starting partial provisioning.
   */
  async ensureImage(image: string) {
    if (await this.engine.imageExists(image)) {
      return;
    }

    throw new ConflictException(
      `Docker image "${image}" is not available locally. Pull it before provisioning.`,
    );
  }

  /**
   * Pulls an image and streams raw progress text to an optional callback.
   */
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

  /**
   * Creates the app network if it does not exist already.
   * The network stays Docker-internal only when host-side iptables enforcement is disabled.
   */
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

  /**
   * Creates the persistent app volume if it does not exist already.
   */
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

  /**
   * Attaches the orchestrator container to the app network when its container id is known.
   * Without this, control-plane access must come from another route.
   */
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

  /**
   * Creates the managed Android container with the requested network, volume, and resource limits.
   * Existing containers with the same name are reused rather than replaced.
   */
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

  /**
   * Best-effort cleanup by name for containers whose id reference was already lost.
   */
  async removeContainerByName(containerName: string) {
    const existing = await this.engine.findContainerByName(containerName);
    if (!existing) {
      return;
    }

    await this.engine.removeContainer(existing.Id);
  }

  async removeNetwork(networkName: string) {
    const attachedContainerIds = await this.engine.listNetworkContainerIds(
      networkName,
    );

    await Promise.all(
      attachedContainerIds.map((containerId) =>
        this.engine.disconnectContainerFromNetwork(containerId, networkName),
      ),
    );

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

  async copyBufferToContainer(
    containerId: string,
    content: Buffer,
    targetDirectory: string,
    targetFileName: string,
  ) {
    await this.engine.copyBufferToContainer(
      containerId,
      content,
      targetDirectory,
      targetFileName,
    );
  }

  async readFileFromContainer(containerId: string, containerPath: string) {
    return this.engine.readFileFromContainer(containerId, containerPath);
  }

  async execInContainer(containerId: string, command: string[]) {
    await this.engine.execInContainer(containerId, command);
  }

  async execInContainerWithOutput(containerId: string, command: string[]) {
    return this.engine.execInContainerWithOutput(containerId, command);
  }

  /**
   * Reads the container IP from a specific Docker network attachment.
   */
  async getContainerIp(containerId: string, networkName: string) {
    const inspect = await this.engine.inspectContainer(containerId);
    return inspect.NetworkSettings.Networks?.[networkName]?.IPAddress || null;
  }

  /**
   * Returns the gateway IP advertised by the app network, if Docker exposed one.
   */
  async getNetworkGateway(networkName: string) {
    const network = await this.engine.docker.getNetwork(networkName).inspect();
    return network.IPAM?.Config?.find((item) => item.Gateway)?.Gateway ?? null;
  }

  /**
   * Resolves the orchestrator container IP on the app network when attached.
   * Missing orchestrator metadata is treated as unavailable instead of an error.
   */
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

  /**
   * Returns Docker disk-usage data for callers that need volume sizing details.
   */
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
