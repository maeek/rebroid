import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import tar from 'tar-stream';
import {
  ContainerCommandFailedException,
  ContainerCommandResult,
} from './docker.types';

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

  async imageExists(image: string) {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch {
      return false;
    }
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
    await this.execInContainerWithOutput(containerId, command);
  }

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
        message: this.containerCommandFailureMessage({
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

  async findContainerByName(name: string) {
    const containers = await this.docker.listContainers({ all: true });
    const dockerName = `/${name}`;
    return containers.find((container) => container.Names.includes(dockerName));
  }

  labels(applicationId: string, component: string) {
    return {
      'com.shop-me-alone.managed': 'true',
      'com.shop-me-alone.application-id': applicationId,
      'com.shop-me-alone.component': component,
      'com.shop-me-alone.resource-prefix': this.resourcePrefix,
    };
  }

  isDockerConflict(error: unknown) {
    return this.hasStatusCode(error, 409);
  }

  isDockerNotFound(error: unknown) {
    return this.hasStatusCode(error, 404);
  }

  isDockerNotModified(error: unknown) {
    return this.hasStatusCode(error, 304);
  }

  isContainerAlreadyConnectedToNetwork(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return message.includes('already connected');
  }

  errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown Docker error';
  }

  private containerCommandFailureMessage({
    command,
    exitCode,
    stdout,
    stderr,
  }: {
    command: string[];
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }) {
    const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join(' ').trim();
    return detail
      ? `Container command failed with exit code ${exitCode}: ${command.join(' ')} ${detail}`
      : `Container command failed with exit code ${exitCode}: ${command.join(' ')}`;
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