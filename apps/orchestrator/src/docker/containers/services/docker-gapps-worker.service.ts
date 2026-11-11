import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Dockerode from 'dockerode';
import type { Readable } from 'node:stream';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../contracts/docker-engine.port';
import type {
  DockerGappsWorkerPort,
  DockerGappsWorkerRequest,
} from '../../contracts/docker-gapps-worker.port';

const workerTimeoutMs = 3 * 60 * 60 * 1000;

@Injectable()
export class DockerGappsWorkerService implements DockerGappsWorkerPort {
  private readonly logger = new Logger(DockerGappsWorkerService.name);

  constructor(
    @Inject(DOCKER_ENGINE) private readonly engine: DockerEnginePort,
    private readonly config: ConfigService,
  ) {}

  run(request: DockerGappsWorkerRequest): Promise<void> {
    return this.engine.longOperation(
      'container_image_gapps_worker',
      `Build GApps package for job ${request.jobId}`,
      (docker, timeoutSignal) => this.runWorker(docker, request, timeoutSignal),
      workerTimeoutMs,
      { waitForCleanup: true },
    );
  }

  private async runWorker(
    docker: Dockerode,
    request: DockerGappsWorkerRequest,
    timeoutSignal: AbortSignal,
  ) {
    const signal = AbortSignal.any([request.signal, timeoutSignal]);
    const requestTimeoutMs = this.config.getOrThrow<number>(
      'app.docker.requestTimeoutMs',
    );
    signal.throwIfAborted();
    const name = `rebroid-gapps-worker-${request.jobId}`;
    const createSignal = AbortSignal.timeout(requestTimeoutMs);
    let container: Dockerode.Container | undefined;
    let logs: Readable | undefined;
    let archive: Readable | undefined;
    let abortCleanup = Promise.resolve();
    const abort = () => {
      logs?.destroy();
      archive?.destroy();
      abortCleanup =
        container
          ?.kill({ abortSignal: AbortSignal.timeout(requestTimeoutMs) })
          .then(() => undefined)
          .catch(() => undefined) ?? Promise.resolve();
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      container = await docker.createContainer({
        Image: request.image,
        name,
        User: '10001:10001',
        // Allow an in-flight create to return its ID even after job cancellation.
        abortSignal: createSignal,
        Env: [
          `SOURCE_REPOSITORY=${request.sourceRepository}`,
          `SOURCE_REVISION=${request.sourceRevision}`,
        ],
        Tty: true,
        NetworkDisabled: false,
        HostConfig: {
          AutoRemove: false,
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges:true'],
          Memory: 3 * 1024 ** 3,
          NanoCpus: 2_000_000_000,
          PidsLimit: 512,
        },
        Labels: {
          'com.rebroid.managed': 'true',
          'com.rebroid.component': 'gapps-patch-worker',
          'com.rebroid.image-build-job': request.jobId,
        },
      });
      signal.throwIfAborted();
      await container.start({ abortSignal: signal });
      signal.throwIfAborted();
      logs = (await container.logs({
        follow: true,
        abortSignal: signal,
        stdout: true,
        stderr: true,
      })) as unknown as Readable;
      // A log transport failure must not become an unhandled stream error.
      logs.on('error', (error) => {
        this.logger.warn(
          `GApps worker log stream failed: ${getErrorMessage(error)}`,
        );
      });
      signal.throwIfAborted();
      logs.on('data', (chunk: Buffer) => {
        const message = chunk.toString('utf8').trim();
        if (message) request.onLog(message);
      });
      const result = await this.waitForWorker(container, signal);
      signal.throwIfAborted();
      logs.destroy();
      if (result.StatusCode !== 0) {
        throw new Error(
          `GApps patch worker exited with status ${result.StatusCode}.`,
        );
      }
      archive = (await container.getArchive({
        path: '/output/package.zip',
        abortSignal: signal,
      })) as unknown as Readable;
      archive.on('error', (error) => {
        this.logger.debug(
          `GApps worker archive stream closed with an error: ${getErrorMessage(error)}`,
        );
      });
      signal.throwIfAborted();
      await request.consumeArchive(archive, signal);
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener('abort', abort);
      logs?.destroy();
      archive?.destroy();
      await abortCleanup;
      if (container || createSignal.aborted) {
        await this.removeWorker(
          docker,
          container,
          name,
          request.jobId,
          requestTimeoutMs,
        );
      }
    }
  }

  private async removeWorker(
    docker: Dockerode,
    container: Dockerode.Container | undefined,
    name: string,
    jobId: string,
    requestTimeoutMs: number,
  ) {
    const worker = container ?? docker.getContainer(name);
    try {
      if (!container) {
        const inspect = await worker.inspect({
          abortSignal: AbortSignal.timeout(requestTimeoutMs),
        });
        const labels = inspect.Config?.Labels;
        if (
          labels?.['com.rebroid.managed'] !== 'true' ||
          labels['com.rebroid.component'] !== 'gapps-patch-worker' ||
          labels['com.rebroid.image-build-job'] !== jobId
        ) {
          throw new Error('GApps worker identity could not be verified.');
        }
      }
      const removeOptions = {
        force: true,
        abortSignal: AbortSignal.timeout(requestTimeoutMs),
      };
      await worker.remove(removeOptions);
    } catch (error) {
      if (this.engine.isDockerNotFound(error)) return;
      this.logger.error(
        `Could not remove GApps worker ${name}: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private async waitForWorker(
    container: Dockerode.Container,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    let abort!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
    });
    try {
      return await Promise.race([
        container.wait({ abortSignal: signal }),
        cancelled,
      ]);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
}
