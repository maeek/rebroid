import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import tar from 'tar-stream';
import { getErrorMessage } from '../common/error-message';
import {
  ContainerCommandFailedException,
  ContainerCommandResult,
} from './docker.types';
import {
  formatContainerCommandFailureMessage,
  hasDockerStatusCode,
} from './utils/docker-engine.utils';

@Injectable()
export class DockerEngineService {
  readonly docker: Dockerode;
  readonly resourcePrefix: string;
  readonly orchestratorContainerId?: string;

  constructor(private readonly config: ConfigService) {
    const dockerHost = process.env.DOCKER_HOST;
    this.docker = dockerHost
      ? new Dockerode({ host: dockerHost })
      : new Dockerode({
          socketPath: this.config.getOrThrow<string>('app.docker.socketPath'),
        });
    this.resourcePrefix = this.config.getOrThrow<string>(
      'app.docker.resourcePrefix',
    );
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

  /**
   * Reads combined stdout and stderr logs with timestamps from a container.
   */
  async getContainerLogs(containerId: string, tail = 300) {
    const container = this.docker.getContainer(containerId);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail,
    });

    return Buffer.isBuffer(stream) ? stream.toString('utf-8') : String(stream);
  }

  /**
   * Checks image availability by inspection and treats any inspect failure as missing.
   */
  async imageExists(image: string) {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Starts a container and ignores Docker's already-started response.
   */
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

  /**
   * Stops a container and ignores already-stopped or missing-container responses.
   */
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

  /**
   * Force-removes a container and ignores missing-container errors.
   */
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

  /**
   * Removes a Docker network and ignores already-missing networks.
   */
  async removeNetwork(networkName: string) {
    try {
      await this.docker.getNetwork(networkName).remove();
    } catch (error) {
      if (!this.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  /**
   * Removes a Docker volume and ignores already-missing volumes.
   */
  async removeVolume(volumeName: string) {
    try {
      await this.docker.getVolume(volumeName).remove();
    } catch (error) {
      if (!this.isDockerNotFound(error)) {
        throw error;
      }
    }
  }

  /**
   * Packs a single local file into a tar stream because Docker archive upload expects tar input.
   */
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
    await this.execInContainerWithOutput(containerId, command);
  }

  /**
   * Executes a command, captures stdout and stderr separately, and throws on non-zero exits.
   */
  async execInContainerWithOutput(
    containerId: string,
    command: string[],
  ): Promise<ContainerCommandResult> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    this.docker.modem.demuxStream(stream, stdout, stderr);

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const result = await exec.inspect();
    const stdoutText = Buffer.concat(stdoutChunks).toString('utf-8');
    const stderrText = Buffer.concat(stderrChunks).toString('utf-8');
    const exitCode = result.ExitCode ?? 0;

    if (exitCode !== 0) {
      throw new ContainerCommandFailedException({
        message: formatContainerCommandFailureMessage({
          command,
          exitCode,
          stdout: stdoutText,
          stderr: stderrText,
        }),
        command,
        exitCode,
        stdout: stdoutText,
        stderr: stderrText,
      });
    }

    return { stdout: stdoutText, stderr: stderrText, exitCode };
  }

  /**
   * Connects a container to a network and treats duplicate attachment as success.
   */
  async connectContainerToNetwork(containerId: string, networkName: string) {
    const network = this.docker.getNetwork(networkName);
    try {
      await network.connect({
        Container: containerId,
      });
    } catch (error) {
      if (
        this.isDockerConflict(error) ||
        this.isContainerAlreadyConnectedToNetwork(error)
      ) {
        return;
      }

      throw error;
    }
  }

  /**
   * Finds a container by exact Docker name, including stopped containers.
   */
  async findContainerByName(name: string) {
    const containers = await this.docker.listContainers({ all: true });
    const dockerName = `/${name}`;
    return containers.find((container) => container.Names.includes(dockerName));
  }

  /**
   * Builds the label set used to identify orchestrator-managed Docker resources.
   */
  labels(applicationId: string, component: string) {
    return {
      'com.rebroid.managed': 'true',
      'com.rebroid.application-id': applicationId,
      'com.rebroid.component': component,
      'com.rebroid.resource-prefix': this.resourcePrefix,
    };
  }

  isDockerConflict(error: unknown) {
    return hasDockerStatusCode(error, 409);
  }

  isDockerNotFound(error: unknown) {
    return hasDockerStatusCode(error, 404);
  }

  isDockerNotModified(error: unknown) {
    return hasDockerStatusCode(error, 304);
  }

  isContainerAlreadyConnectedToNetwork(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return message.includes('already connected');
  }

  /**
   * Normalizes Docker and transport errors into a single readable message.
   */
  errorMessage(error: unknown) {
    return getErrorMessage(error, 'Unknown Docker error');
  }
}