import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import { getErrorMessage } from '../../common/error-message';
import { DockerEngineService } from '../../docker/docker-engine.service';
import { DockerImageRuntimeMetadataService } from '../../docker/images/services/docker-image-runtime-metadata.service';
import { DockerImageRuntimeService } from '../../docker/images/services/docker-image-runtime.service';
import { StartContainerImageBuildDto } from '../dto/container-image-build.dto';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildContextService } from './container-image-build-context.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import {
  dockerfileWithRequiredLabels,
  requiredRuntimeImageLabels,
} from '../utils/container-image-dockerfile-labels';
import { validateContainerImageBuildReference } from '../utils/container-image-reference';

type DockerProgressEvent = {
  stream?: string;
  status?: string;
  progress?: string;
  id?: string;
  error?: string;
  errorDetail?: { message?: string };
};

type ActiveBuild = {
  cancelled: boolean;
  stream?: Readable;
};

const cleanNullable = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

@Injectable()
export class ContainerImageBuilderService {
  private readonly logger = new Logger(ContainerImageBuilderService.name);
  private readonly activeBuilds = new Map<string, ActiveBuild>();

  constructor(
    private readonly jobs: ContainerImageBuildJobService,
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly metadata: DockerImageRuntimeMetadataService,
    private readonly context: ContainerImageBuildContextService,
    private readonly archive: ContainerImageBuildArchiveService,
  ) {}

  listJobs() {
    return this.jobs.listJobs();
  }

  getJob(id: string) {
    return this.jobs.getJob(id);
  }

  async startBuild(dto: StartContainerImageBuildDto) {
    const targetImage = validateContainerImageBuildReference(
      dto.targetImage,
      'Target image',
    );
    const baseImage = validateContainerImageBuildReference(
      dto.baseImage,
      'Base image',
    );
    const runtimeKind = dto.runtimeKind ?? 'redroid';
    const metadata = {
      runtimeKind,
      androidVersion: cleanNullable(dto.androidVersion),
      architecture: cleanNullable(dto.architecture),
      gmsMode: dto.gmsMode ?? (runtimeKind === 'redroid' ? 'microg' : 'none'),
      signatureSpoofing:
        dto.signatureSpoofing ??
        (runtimeKind === 'redroid' ? 'external_required' : 'not_applicable'),
    };
    const dockerfile = dockerfileWithRequiredLabels(
      dto.dockerfile,
      requiredRuntimeImageLabels(metadata),
    );
    const contextFileIds = dto.contextFileIds ?? [];
    const job = await this.jobs.createQueuedJob({
      recipeId: cleanNullable(dto.recipeId),
      targetImage,
      baseImage,
      runtimeKind: metadata.runtimeKind,
      androidVersion: metadata.androidVersion,
      architecture: metadata.architecture,
      gmsMode: metadata.gmsMode,
      signatureSpoofing: metadata.signatureSpoofing,
      dockerfile,
      contextFileIds,
    });

    void this.runBuild(job.id).catch((error) => {
      this.logger.error(
        `Image build ${job.id} crashed: ${getErrorMessage(error)}`,
      );
    });
    return job;
  }

  async cancelBuild(id: string) {
    const job = await this.getJob(id);
    if (this.jobs.isTerminal(job.status)) {
      return job;
    }

    const active = this.activeBuilds.get(id);
    if (active) {
      active.cancelled = true;
      active.stream?.destroy(new Error('Container image build cancelled.'));
    }

    return this.jobs.markCancelled(job);
  }

  private async runBuild(id: string) {
    const job = await this.getJob(id);
    if (job.status === 'cancelled') {
      return;
    }

    const active: ActiveBuild = { cancelled: false };
    this.activeBuilds.set(id, active);
    await this.jobs.markRunning(job);

    try {
      const contextFileIds = JSON.parse(job.contextFileIdsJson) as string[];
      const contextFiles = await this.context.findByIds(contextFileIds);
      const foundContextFileIds = new Set(contextFiles.map((file) => file.id));
      const missingContextFileIds = contextFileIds.filter(
        (fileId) => !foundContextFileIds.has(fileId),
      );
      if (missingContextFileIds.length > 0) {
        throw new ConflictException(
          `Build context files are missing: ${missingContextFileIds.join(', ')}`,
        );
      }
      const buildContext = await this.archive.createTar(
        job.dockerfile,
        contextFiles,
      );
      await this.engine.longOperation(
        'container_image_build',
        `Build container image ${job.targetImage}`,
        async (docker, signal) => {
          const stream = (await docker.buildImage(buildContext, {
            t: job.targetImage,
            abortSignal: signal,
          })) as unknown as Readable;
          active.stream = stream;
          const abort = () =>
            stream.destroy(
              new Error(`Build image ${job.targetImage} aborted.`),
            );
          signal.addEventListener('abort', abort, { once: true });
          await new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(
              stream,
              (error) => {
                signal.removeEventListener('abort', abort);
                if (error) {
                  reject(error);
                  return;
                }

                resolve();
              },
              (event: DockerProgressEvent) => {
                const message = this.progressMessage(event);
                if (message) {
                  void this.jobs.appendLog(id, message);
                }
              },
            );
          });
        },
      );

      const current = await this.getJob(id);
      if (current.status === 'cancelled' || active.cancelled) {
        return;
      }

      const inspect = await this.images.inspectImage(job.targetImage);
      await this.jobs.markSucceeded(current, inspect.Id);
      await this.metadata.upsert({
        imageRef: job.targetImage,
        imageId: inspect.Id,
        runtimeKind: job.runtimeKind,
        androidVersion: job.androidVersion,
        architecture: job.architecture,
        gmsMode: job.gmsMode,
        signatureSpoofing: job.signatureSpoofing,
      });
    } catch (error) {
      const current = await this.getJob(id);
      if (current.status === 'cancelled' || active.cancelled) {
        await this.jobs.markCancelled(current);
        return;
      }

      const message = getErrorMessage(error);
      await this.jobs.markFailed(current, message);
    } finally {
      this.activeBuilds.delete(id);
    }
  }

  private progressMessage(event: DockerProgressEvent) {
    if (event.errorDetail?.message) {
      return event.errorDetail.message;
    }
    if (event.error) {
      return event.error;
    }
    if (event.stream?.trim()) {
      return event.stream.trim();
    }

    return [event.id, event.status, event.progress].filter(Boolean).join(' ');
  }
}
