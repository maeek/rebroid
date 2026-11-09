import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { addAbortSignal, Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerEngineService } from '../../docker-engine.service';
import { ContainerRuntimeState } from '../../docker.types';
import { decodeDockerLogStream } from '../utils/docker-log-stream';
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

  async findContainerByName(name: string, applicationId?: string) {
    const containers = await this.engine.read(
      () => this.engine.docker.listContainers({ all: true }),
      `List containers while finding ${name}`,
    );
    const dockerName = `/${name}`;
    const container = containers.find((item) =>
      item.Names.includes(dockerName),
    );
    if (container && applicationId) {
      this.assertManagedRuntime(container.Labels, applicationId, name);
    }
    return container;
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

    return Buffer.isBuffer(stream)
      ? decodeDockerLogStream(stream)
      : String(stream);
  }

  getBoundedContainerLogs(containerId: string, tail: number, maxBytes: number) {
    return this.engine.read(async () => {
      const signal = AbortSignal.timeout(5_000);
      const stream = await new Promise<Readable>((resolve, reject) => {
        // Dockerode buffers the entire response for non-following logs.
        this.engine.docker.modem.dial(
          {
            path: `/containers/${encodeURIComponent(containerId)}/logs?`,
            method: 'GET',
            options: { stdout: true, stderr: true, timestamps: true, tail },
            isStream: true,
            abortSignal: signal,
            statusCodes: {
              200: true,
              404: 'no such container',
              500: 'server error',
            },
          },
          (error, response) => {
            if (error) reject(error);
            else if (response instanceof Readable)
              resolve(addAbortSignal(signal, response));
            else reject(new Error('Expected a Docker log stream.'));
          },
        );
      });
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > maxBytes) {
          throw new PayloadTooLargeException(
            'The container log tail exceeds the read limit.',
          );
        }
        chunks.push(chunk);
      }
      return decodeDockerLogStream(Buffer.concat(chunks, size));
    }, `Read bounded logs for container ${containerId}`);
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
      applicationId?: string;
    },
  ) {
    if (options?.applicationId) {
      try {
        const inspect = await this.inspectContainer(containerId);
        this.assertManagedRuntime(
          inspect.Config?.Labels,
          options.applicationId,
          containerId,
        );
        containerId = inspect.Id;
      } catch (error) {
        if (this.engine.isDockerNotFound(error)) return;
        throw error;
      }
    }
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

  async removeContainerByName(containerName: string, applicationId?: string) {
    const existing = await this.findContainerByName(
      containerName,
      applicationId,
    );
    if (!existing) {
      return;
    }

    await this.removeContainer(existing.Id);
  }

  private assertManagedRuntime(
    labels: Record<string, string> | undefined,
    applicationId: string,
    container: string,
  ) {
    if (
      labels?.['com.rebroid.managed'] !== 'true' ||
      labels['com.rebroid.application-id'] !== applicationId ||
      labels['com.rebroid.component'] !== 'runtime'
    ) {
      throw new Error(
        `Docker container ${container} is not managed by this application.`,
      );
    }
  }
}
