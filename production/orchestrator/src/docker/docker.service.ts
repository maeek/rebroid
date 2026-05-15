import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import tar from 'tar-stream';

export interface RedroidContainerSpec {
  applicationId: string;
  containerName: string;
  networkName: string;
  volumeName: string;
  image: string;
  dataMountPath: string;
  adbPort: number;
  privileged: boolean;
}

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);
  private readonly docker: Dockerode;
  private readonly resourcePrefix: string;
  private readonly orchestratorContainerId?: string;

  constructor(private readonly config: ConfigService) {
    this.docker = new Dockerode({
      socketPath: this.config.getOrThrow<string>('app.docker.socketPath'),
    });
    this.resourcePrefix = this.config.getOrThrow<string>('app.docker.resourcePrefix');
    this.orchestratorContainerId = this.config.get<string>(
      'app.docker.orchestratorContainerId',
    );
  }

  async ping() {
    await this.docker.ping();
  }

  async inspectContainer(containerId: string) {
    return this.docker.getContainer(containerId).inspect();
  }

  async imageExists(image: string) {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  async ensureImage(image: string) {
    if (await this.imageExists(image)) {
      return;
    }

    throw new ConflictException(
      `Docker image "${image}" is not available locally. Pull it before provisioning.`,
    );
  }

  async pullImage(image: string, onProgress?: (message: string) => void) {
    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
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
    return this.docker.listImages();
  }

  async removeImage(image: string, force = false) {
    return this.docker.getImage(image).remove({ force });
  }

  async pruneImages(danglingOnly = true) {
    return this.docker.pruneImages({
      dangling: danglingOnly ? ['true'] : ['false'],
    });
  }

  async pruneContainers() {
    return this.docker.pruneContainers();
  }

  async pruneNetworks() {
    return this.docker.pruneNetworks();
  }

  async pruneVolumes() {
    return this.docker.pruneVolumes();
  }

  async createIsolatedNetwork(applicationId: string, networkName: string) {
    const existing = await this.findNetworkByName(networkName);
    if (existing) {
      return existing;
    }

    return this.docker.createNetwork({
      Name: networkName,
      Internal: true,
      CheckDuplicate: true,
      Labels: this.labels(applicationId, 'network'),
    });
  }

  async createVolume(applicationId: string, volumeName: string) {
    const existing = await this.findVolumeByName(volumeName);
    if (existing) {
      return existing;
    }

    return this.docker.createVolume({
      Name: volumeName,
      Labels: this.labels(applicationId, 'volume'),
    });
  }

  async connectOrchestratorToNetwork(networkName: string) {
    if (!this.orchestratorContainerId) {
      this.logger.warn(
        `ORCHESTRATOR_CONTAINER_ID is not set; scrcpy proxying requires another path to reach ${networkName}.`,
      );
      return;
    }

    const network = this.docker.getNetwork(networkName);
    try {
      await network.connect({
        Container: this.orchestratorContainerId,
      });
    } catch (error) {
      if (this.isDockerConflict(error)) {
        return;
      }

      throw error;
    }
  }

  async createRedroidContainer(spec: RedroidContainerSpec) {
    await this.ensureImage(spec.image);

    const existing = await this.findContainerByName(spec.containerName);
    if (existing) {
      return this.docker.getContainer(existing.Id);
    }

    return this.docker.createContainer({
      Image: spec.image,
      name: spec.containerName,
      Env: [`ADB_TCP_PORT=${spec.adbPort}`],
      ExposedPorts: {
        [`${spec.adbPort}/tcp`]: {},
      },
      Labels: this.labels(spec.applicationId, 'redroid'),
      HostConfig: {
        NetworkMode: spec.networkName,
        Privileged: spec.privileged,
        Mounts: [
          {
            Type: 'volume',
            Source: spec.volumeName,
            Target: spec.dataMountPath,
          },
        ],
        PublishAllPorts: false,
        AutoRemove: false,
        RestartPolicy: {
          Name: 'no',
        },
      },
      NetworkingConfig: {
        EndpointsConfig: {
          [spec.networkName]: {},
        },
      },
    });
  }

  async startContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    try {
      await container.start();
    } catch (error) {
      if (!this.isDockerNotModified(error)) {
        throw error;
      }
    }
  }

  async stopContainer(containerId: string, timeoutSeconds = 10) {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: timeoutSeconds });
    } catch (error) {
      if (!this.isDockerNotModified(error) && !this.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async removeContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    try {
      await container.remove({ force: true, v: false });
    } catch (error) {
      if (!this.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async removeNetwork(networkName: string) {
    try {
      await this.docker.getNetwork(networkName).remove();
    } catch (error) {
      if (!this.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async removeVolume(volumeName: string) {
    try {
      await this.docker.getVolume(volumeName).remove();
    } catch (error) {
      if (!this.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  async copyFileToContainer(
    containerId: string,
    sourcePath: string,
    targetDirectory: string,
    targetFileName = basename(sourcePath),
  ) {
    const container = this.docker.getContainer(containerId);
    const content = await readFile(sourcePath);
    const pack = tar.pack();

    await new Promise<void>((resolve, reject) => {
      pack.entry(
        {
          name: targetFileName,
          mode: 0o644,
          size: content.length,
        },
        content,
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          pack.finalize();
          resolve();
        },
      );
    });

    await container.putArchive(pack, {
      path: targetDirectory,
    });
  }

  async execInContainer(containerId: string, command: string[]) {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const result = await exec.inspect();
    if (result.ExitCode !== 0) {
      throw new ConflictException(
        `Container command failed with exit code ${result.ExitCode}: ${command.join(' ')}`,
      );
    }
  }

  private async findContainerByName(name: string) {
    const containers = await this.docker.listContainers({ all: true });
    const dockerName = `/${name}`;
    return containers.find((container) => container.Names.includes(dockerName));
  }

  private async findNetworkByName(name: string) {
    const networks = await this.docker.listNetworks({
      filters: { name: [name] },
    });
    const network = networks.find((item) => item.Name === name);
    return network ? this.docker.getNetwork(network.Id) : undefined;
  }

  private async findVolumeByName(name: string) {
    const volumes = await this.docker.listVolumes({
      filters: { name: [name] },
    });
    const volume = volumes.Volumes?.find((item) => item.Name === name);
    return volume ? this.docker.getVolume(volume.Name) : undefined;
  }

  private labels(applicationId: string, component: string) {
    return {
      'com.shop-me-alone.managed': 'true',
      'com.shop-me-alone.application-id': applicationId,
      'com.shop-me-alone.component': component,
      'com.shop-me-alone.resource-prefix': this.resourcePrefix,
    };
  }

  private isDockerConflict(error: unknown) {
    return this.hasStatusCode(error, 409);
  }

  private isDockerNotFound(error: unknown) {
    return this.hasStatusCode(error, 404);
  }

  private isDockerNotModified(error: unknown) {
    return this.hasStatusCode(error, 304);
  }

  private hasStatusCode(error: unknown, statusCode: number) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === statusCode
    );
  }
}
