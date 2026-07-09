import { Injectable } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerEngineService } from '../../docker-engine.service';
import { ContainerRuntimeState } from '../../docker.types';
import type { DockerContainerLifecyclePort } from '../../contracts/docker-container-lifecycle.port';

@Injectable()
export class DockerContainerLifecycleService implements DockerContainerLifecyclePort {
  constructor(private readonly engine: DockerEngineService) {}

  async inspectContainer(containerId: string) {
    return this.engine.coalesceRead(
      `container-inspect:${containerId}`,
      () => this.engine.docker.getContainer(containerId).inspect(),
      `Inspect container ${containerId}`,
    );
  }

  async findContainerByName(name: string) {
    const containers = await this.engine.read(
      () => this.engine.docker.listContainers({ all: true }),
      `List containers while finding ${name}`,
    );
    const dockerName = `/${name}`;
    return containers.find((container) => container.Names.includes(dockerName));
  }

  async getContainerRuntimeState(
    containerId: string,
  ): Promise<ContainerRuntimeState> {
    try {
      const inspect = await this.inspectContainer(containerId);
      return {
        exists: true,
        running: Boolean(inspect.State?.Running),
        status: inspect.State?.Status ?? null,
        exitCode:
          typeof inspect.State?.ExitCode === 'number'
            ? inspect.State.ExitCode
            : null,
        oomKilled: Boolean(inspect.State?.OOMKilled),
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
          oomKilled: false,
          error: null,
          finishedAt: null,
        };
      }

      throw error;
    }
  }

  async getContainerLogs(containerId: string, tail = 300) {
    const container = this.engine.docker.getContainer(containerId);
    const stream = await this.engine.read(
      () =>
        container.logs({
          stdout: true,
          stderr: true,
          timestamps: true,
          tail,
        }),
      `Read logs for container ${containerId}`,
    );

    return Buffer.isBuffer(stream) ? stream.toString('utf-8') : String(stream);
  }

  async startContainer(containerId: string) {
    const container = this.engine.docker.getContainer(containerId);
    try {
      await this.engine.mutate(
        () => container.start(),
        `Start container ${containerId}`,
      );
    } catch (error) {
      if (!this.engine.isDockerNotModified(error)) {
        throw error;
      }
    }
  }

  async stopContainer(containerId: string, timeoutSeconds = 0) {
    const container = this.engine.docker.getContainer(containerId);
    try {
      await this.engine.mutate(
        () => container.stop({ t: timeoutSeconds }),
        `Stop container ${containerId}`,
      );
    } catch (error) {
      if (
        !this.engine.isDockerNotModified(error) &&
        !this.engine.isDockerNotFound(error)
      ) {
        throw error;
      }
    }
  }

  async removeContainer(
    containerId: string,
    options?: {
      force?: boolean;
      removeVolumes?: boolean;
      maxAttempts?: number;
      retryDelayMs?: number;
    },
  ) {
    const container = this.engine.docker.getContainer(containerId);
    const force = options?.force ?? true;
    const removeVolumes = options?.removeVolumes ?? false;
    const maxAttempts = options?.maxAttempts ?? (force ? 5 : 1);
    const retryDelayMs = options?.retryDelayMs ?? 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.engine.mutate(
          () => container.remove({ force, v: removeVolumes }),
          `Remove container ${containerId}`,
        );
        return;
      } catch (error) {
        if (this.engine.isDockerNotFound(error)) {
          return;
        }

        const shouldRetry =
          force &&
          attempt < maxAttempts &&
          this.engine.isContainerRemovalInProgress(error);

        if (!shouldRetry) {
          throw error;
        }

        await delay(retryDelayMs);
      }
    }
  }

  async removeContainerByName(containerName: string) {
    const existing = await this.findContainerByName(containerName);
    if (!existing) {
      return;
    }

    await this.removeContainer(existing.Id);
  }
}
