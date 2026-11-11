import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { posix } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_GAPPS_WORKER,
  type DockerGappsWorkerPort,
} from '../../docker/contracts/docker-gapps-worker.port';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../../docker/contracts/docker-image-runtime.port';
import type { GappsBuildPresetDto } from '../dto/gapps-build.dto';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageGappsCacheService } from './container-image-gapps-cache.service';

const maxPackageBytes = 2 * 1024 ** 3;
const workerImageVersion = '1';

@Injectable()
export class ContainerImageGappsWorkerService {
  private readonly logger = new Logger(ContainerImageGappsWorkerService.name);
  private workerImagePromise?: Promise<void>;

  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_GAPPS_WORKER)
    private readonly worker: DockerGappsWorkerPort,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    private readonly archive: ContainerImageBuildArchiveService,
    private readonly jobs: ContainerImageBuildJobService,
    private readonly cache: ContainerImageGappsCacheService,
  ) {}

  async buildPackage(
    jobId: string,
    preset: GappsBuildPresetDto,
    revision: string,
    signal: AbortSignal,
  ) {
    let temporaryPath: string | null = null;
    let completed = false;

    try {
      signal.throwIfAborted();
      await this.ensureWorkerImage(signal);
      signal.throwIfAborted();
      const packageDestination = await this.cache.createTemporaryPath(jobId);
      temporaryPath = packageDestination;
      await rm(packageDestination, { force: true });
      await this.worker.run({
        image: this.config.getOrThrow<string>('app.gappsPatcher.image'),
        jobId,
        sourceRepository: preset.sourceRepository,
        sourceRevision: revision,
        signal,
        onLog: (message) => {
          void this.jobs.appendLog(jobId, message).catch((error) => {
            this.logger.warn(
              `Could not save GApps worker log: ${getErrorMessage(error)}`,
            );
          });
        },
        consumeArchive: (source, signal) =>
          this.extractPackageFromDockerArchive(
            source,
            packageDestination,
            signal,
          ),
      });
      signal.throwIfAborted();
      completed = true;
      return packageDestination;
    } finally {
      if (!completed && temporaryPath) {
        await this.cache.removeTemporary(temporaryPath);
      }
    }
  }

  private ensureWorkerImage(signal: AbortSignal) {
    if (!this.workerImagePromise) {
      this.workerImagePromise = this.buildWorkerImage(signal).catch((error) => {
        this.workerImagePromise = undefined;
        throw error;
      });
    }
    return this.workerImagePromise;
  }

  private async buildWorkerImage(signal: AbortSignal) {
    const image = this.config.getOrThrow<string>('app.gappsPatcher.image');
    if (await this.images.imageExists(image)) {
      const inspect = await this.images.inspectImage(image);
      if (
        inspect.Config?.Labels?.['com.rebroid.gapps-patcher.version'] ===
        workerImageVersion
      )
        return;
    }

    signal.throwIfAborted();
    const context = this.archive.createFilesystemTar(
      this.config.getOrThrow<string>('app.gappsPatcher.buildContext'),
    );
    await this.images.buildImage({
      context,
      targetImage: image,
      operationName: 'container_image_gapps_worker_image',
      description: 'Build isolated GApps patch worker image',
      timeoutMs: 15 * 60 * 1000,
      signal,
      onProgress: (message) => this.logger.debug(message),
    });
  }

  private async extractPackageFromDockerArchive(
    source: Readable,
    destination: string,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const extract = tar.extract();
    let writing: Promise<void> | undefined;
    extract.on('entry', (header, entry, next) => {
      if (writing || posix.basename(header.name) !== 'package.zip') {
        entry.on('end', next);
        entry.resume();
        return;
      }
      if (header.type !== 'file') {
        extract.destroy(
          new Error('Generated GApps package is not a regular file.'),
        );
        return;
      }
      if ((header.size ?? 0) > maxPackageBytes) {
        extract.destroy(new Error('Generated GApps package exceeds 2 GB.'));
        return;
      }
      writing = pipeline(
        entry,
        createWriteStream(destination, { flags: 'wx' }),
        { signal },
      );
      void writing.then(
        () => next(),
        (error: Error) => next(error),
      );
    });
    try {
      await pipeline(source, extract, { signal });
      if (!writing)
        throw new Error('GApps patch worker did not return a package.');
    } finally {
      await writing?.catch(() => undefined);
    }
  }
}
