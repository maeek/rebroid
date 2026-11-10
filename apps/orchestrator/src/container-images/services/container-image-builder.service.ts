import { Inject, ConflictException, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_IMAGE_RUNTIME_METADATA,
  type DockerImageRuntimeMetadataPort,
} from '../../docker/contracts/docker-image-runtime-metadata.port';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../../docker/contracts/docker-image-runtime.port';
import { StartContainerImageBuildDto } from '../dto/container-image-build.dto';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildContextService } from './container-image-build-context.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import {
  dockerfileWithRequiredLabels,
  requiredRuntimeImageLabels,
} from '../utils/container-image-dockerfile-labels';
import { validateContainerImageBuildReference } from '../utils/container-image-reference';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

const cleanNullable = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

@Injectable()
export class ContainerImageBuilderService {
  private readonly logger = new Logger(ContainerImageBuilderService.name);
  private readonly activeBuilds = new Map<string, AbortController>();

  constructor(
    private readonly jobs: ContainerImageBuildJobService,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_IMAGE_RUNTIME_METADATA)
    private readonly metadata: DockerImageRuntimeMetadataPort,
    private readonly context: ContainerImageBuildContextService,
    private readonly archive: ContainerImageBuildArchiveService,
    private readonly features: FeatureFlagsService,
  ) {}

  listJobs() {
    return this.jobs.listJobs();
  }

  getJob(id: string) {
    return this.jobs.getJob(id);
  }

  async startBuild(dto: StartContainerImageBuildDto) {
    this.features.assertEnabled('feature.image-builder');
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

    this.activeBuilds
      .get(id)
      ?.abort(new Error('Container image build cancelled.'));

    return this.jobs.markCancelled(job);
  }

  private async runBuild(id: string) {
    const job = await this.getJob(id);
    if (job.status === 'cancelled') {
      return;
    }

    const active = new AbortController();
    this.activeBuilds.set(id, active);
    const runningJob = await this.jobs.markRunning(job);
    if (runningJob.status !== 'running') {
      this.activeBuilds.delete(id);
      return;
    }
    await this.jobs.updateGappsDetails(job, { phase: 'building_image' });

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
      await this.images.buildImage({
        context: buildContext,
        targetImage: job.targetImage,
        operationName: 'container_image_build',
        description: `Build container image ${job.targetImage}`,
        signal: active.signal,
        onProgress: (message) => {
          void this.jobs.appendLog(id, message);
        },
      });

      const current = await this.getJob(id);
      if (current.status === 'cancelled' || active.signal.aborted) {
        return;
      }

      const inspect = await this.images.inspectImage(job.targetImage);
      await this.metadata.upsert({
        imageRef: job.targetImage,
        imageId: inspect.Id,
        runtimeKind: job.runtimeKind,
        androidVersion: job.androidVersion,
        architecture: job.architecture,
        gmsMode: job.gmsMode,
        signatureSpoofing: job.signatureSpoofing,
      });
      await this.jobs.markSucceeded(current, inspect.Id);
    } catch (error) {
      const current = await this.getJob(id);
      if (current.status === 'cancelled' || active.signal.aborted) {
        await this.jobs.markCancelled(current);
        return;
      }

      const message = getErrorMessage(error);
      await this.jobs.markFailed(current, message);
    } finally {
      this.activeBuilds.delete(id);
    }
  }
}
