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
import type { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import type { ContainerImageBuildKind } from '../entities/container-image-gapps-build';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildContextService } from './container-image-build-context.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageBuildLifecycleService } from './container-image-build-lifecycle.service';
import {
  dockerfileWithRequiredLabels,
  requiredRuntimeImageLabels,
} from '../utils/container-image-dockerfile-labels';
import { validateContainerImageBuildReference } from '../utils/container-image-reference';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

import { buildRuntimeMetadata } from '../utils/container-image-build-metadata';

@Injectable()
export class ContainerImageBuilderService {
  private readonly logger = new Logger(ContainerImageBuilderService.name);

  constructor(
    private readonly jobs: ContainerImageBuildJobService,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_IMAGE_RUNTIME_METADATA)
    private readonly metadata: DockerImageRuntimeMetadataPort,
    private readonly context: ContainerImageBuildContextService,
    private readonly archive: ContainerImageBuildArchiveService,
    private readonly features: FeatureFlagsService,
    private readonly lifecycle: ContainerImageBuildLifecycleService,
  ) {}

  listJobs() {
    return this.jobs.listJobs();
  }

  findLatestJob(buildKind: ContainerImageBuildKind) {
    return this.jobs.findLatestJob(buildKind);
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
    const metadata = buildRuntimeMetadata(dto);
    const dockerfile = dockerfileWithRequiredLabels(
      dto.dockerfile,
      requiredRuntimeImageLabels(metadata),
    );
    const contextFileIds = dto.contextFileIds ?? [];
    const job = await this.jobs.createQueuedJob({
      recipeId: dto.recipeId?.trim() || null,
      targetImage,
      baseImage,
      ...metadata,
      dockerfile,
      contextFileIds,
    });

    void this.lifecycle
      .run(job, (signal) => this.build(job, signal))
      .catch((error) => {
        this.logger.error(
          `Image build ${job.id} crashed: ${getErrorMessage(error)}`,
        );
      });
    return job;
  }

  private async build(job: ContainerImageBuildJob, signal: AbortSignal) {
    await this.jobs.updateBuildDetails(job.id, { phase: 'building_image' });
    signal.throwIfAborted();

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
    signal.throwIfAborted();
    const buildContext = await this.archive.createTar(
      job.dockerfile,
      contextFiles,
    );
    await this.images.buildImage({
      context: buildContext,
      targetImage: job.targetImage,
      operationName: 'container_image_build',
      description: `Build container image ${job.targetImage}`,
      signal,
      onProgress: (message) => this.jobs.recordProgress(job.id, message),
    });

    signal.throwIfAborted();
    const inspect = await this.images.inspectImage(job.targetImage);
    signal.throwIfAborted();
    await this.metadata.upsert({
      imageRef: job.targetImage,
      imageId: inspect.Id,
      runtimeKind: job.runtimeKind,
      androidVersion: job.androidVersion,
      architecture: job.architecture,
      gmsMode: job.gmsMode,
      signatureSpoofing: job.signatureSpoofing,
    });
    return inspect.Id;
  }
}
