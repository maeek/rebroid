import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import type Dockerode from 'dockerode';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../docker/contracts/docker-engine.port';
import type { GappsBuildPresetDto } from '../dto/gapps-build.dto';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageGappsCacheService } from './container-image-gapps-cache.service';

type DockerProgressEvent = {
  stream?: string;
  status?: string;
  progress?: string;
  id?: string;
  error?: string;
  errorDetail?: { message?: string };
};

type ActiveWorker = {
  cancelled: boolean;
  container?: Dockerode.Container;
  logStream?: Readable;
};

const maxPackageBytes = 2 * 1024 ** 3;
const workerTimeoutMs = 3 * 60 * 60 * 1000;
const workerImageVersion = '1';

@Injectable()
export class ContainerImageGappsWorkerService {
  private readonly logger = new Logger(ContainerImageGappsWorkerService.name);
  private readonly active = new Map<string, ActiveWorker>();
  private workerImagePromise?: Promise<void>;

  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_ENGINE) private readonly engine: DockerEnginePort,
    private readonly archive: ContainerImageBuildArchiveService,
    private readonly jobs: ContainerImageBuildJobService,
    private readonly cache: ContainerImageGappsCacheService,
  ) {}

  async buildPackage(
    jobId: string,
    preset: GappsBuildPresetDto,
    revision: string,
  ) {
    const active: ActiveWorker = { cancelled: false };
    this.active.set(jobId, active);
    let temporaryPath: string | null = null;
    let completed = false;

    try {
      await this.ensureWorkerImage();
      if (active.cancelled) throw new Error('GApps build cancelled.');
      const packageDestination = await this.cache.createTemporaryPath(jobId);
      temporaryPath = packageDestination;
      await rm(packageDestination, { force: true });
      await this.engine.longOperation(
        'container_image_gapps_worker',
        `Build MindTheGapps package for Android ${preset.androidVersion}`,
        async (docker, signal) => {
          const container = await docker.createContainer({
            Image: this.config.getOrThrow<string>('app.gappsPatcher.image'),
            Env: [
              `SOURCE_REPOSITORY=${preset.sourceRepository}`,
              `SOURCE_REVISION=${revision}`,
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
              'com.rebroid.image-build-job': jobId,
            },
          });
          active.container = container;
          if (active.cancelled) {
            await container.remove({ force: true });
            throw new Error('GApps build cancelled.');
          }
          const abort = () => void container.kill().catch(() => undefined);
          signal.addEventListener('abort', abort, { once: true });
          await container.start();
          const logs = (await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
          })) as unknown as Readable;
          active.logStream = logs;
          logs.on('data', (chunk: Buffer) => {
            const message = chunk.toString('utf8').trim();
            if (message) void this.jobs.appendLog(jobId, message);
          });
          const result = await container.wait();
          signal.removeEventListener('abort', abort);
          logs.destroy();
          if (result.StatusCode !== 0) {
            throw new Error(
              `GApps patch worker exited with status ${result.StatusCode}.`,
            );
          }
          const output = (await container.getArchive({
            path: '/output/package.zip',
          })) as unknown as Readable;
          await this.extractPackageFromDockerArchive(
            output,
            packageDestination,
          );
        },
        workerTimeoutMs,
      );
      completed = true;
      return packageDestination;
    } finally {
      const worker = this.active.get(jobId);
      worker?.logStream?.destroy();
      await worker?.container?.remove({ force: true }).catch(() => undefined);
      if (!completed && temporaryPath) {
        await this.cache.removeTemporary(temporaryPath);
      }
      this.active.delete(jobId);
    }
  }

  async cancel(jobId: string) {
    const worker = this.active.get(jobId);
    if (worker) worker.cancelled = true;
    worker?.logStream?.destroy(new Error('GApps build cancelled.'));
    await worker?.container?.kill().catch(() => undefined);
  }

  private ensureWorkerImage() {
    if (!this.workerImagePromise) {
      this.workerImagePromise = this.buildWorkerImage().catch((error) => {
        this.workerImagePromise = undefined;
        throw error;
      });
    }
    return this.workerImagePromise;
  }

  private async buildWorkerImage() {
    const image = this.config.getOrThrow<string>('app.gappsPatcher.image');
    try {
      const inspect = await this.engine.docker.getImage(image).inspect();
      if (
        inspect.Config?.Labels?.['com.rebroid.gapps-patcher.version'] ===
        workerImageVersion
      ) {
        return;
      }
    } catch (error) {
      if (!this.engine.isDockerNotFound(error)) {
        throw error;
      }
    }

    const context = this.archive.createFilesystemTar(
      this.config.getOrThrow<string>('app.gappsPatcher.buildContext'),
    );
    await this.engine.longOperation(
      'container_image_gapps_worker_image',
      'Build isolated GApps patch worker image',
      async (docker, signal) => {
        const stream = (await docker.buildImage(context, {
          t: image,
          abortSignal: signal,
        })) as unknown as Readable;
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(
            stream,
            (error) => (error ? reject(error) : resolve()),
            (event: DockerProgressEvent) => {
              const message = this.progressMessage(event);
              if (message) this.logger.debug(message);
            },
          );
        });
      },
      15 * 60 * 1000,
    );
  }

  private extractPackageFromDockerArchive(
    source: Readable,
    destination: string,
  ) {
    return new Promise<void>((resolve, reject) => {
      const extract = tar.extract();
      let found = false;
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(new Error(getErrorMessage(error)));
      };
      extract.on('entry', (header, entry, next) => {
        if (found || !header.name.endsWith('package.zip')) {
          entry.resume();
          entry.on('end', next);
          return;
        }
        if ((header.size ?? 0) > maxPackageBytes) {
          entry.resume();
          fail(new Error('Generated GApps package exceeds 2 GB.'));
          return;
        }
        found = true;
        pipeline(entry, createWriteStream(destination, { flags: 'wx' }))
          .then(() => next())
          .catch(fail);
      });
      extract.on('error', fail);
      source.on('error', fail);
      extract.on('finish', () => {
        if (settled) return;
        if (!found) {
          fail(new Error('GApps patch worker did not return a package.'));
          return;
        }
        settled = true;
        resolve();
      });
      source.pipe(extract);
    });
  }

  private progressMessage(event: DockerProgressEvent) {
    return (
      event.errorDetail?.message ??
      event.error ??
      event.stream?.trim() ??
      [event.id, event.status, event.progress].filter(Boolean).join(' ')
    );
  }
}
