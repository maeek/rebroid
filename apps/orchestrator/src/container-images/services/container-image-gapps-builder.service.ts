import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import { KeyedSerialQueue } from '../../common/keyed-serial-queue';
import {
  DOCKER_IMAGE_RUNTIME_METADATA,
  type DockerImageRuntimeMetadataPort,
} from '../../docker/contracts/docker-image-runtime-metadata.port';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../../docker/contracts/docker-image-runtime.port';
import type {
  StartGappsBuildDto,
  SupportedGappsAndroidVersion,
} from '../dto/gapps-build.dto';
import type { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import { runtimeImageLabelKeys } from '@rebroid/android-application-core/redroid-runtime';
import {
  dockerfileWithRequiredLabels,
  requiredRuntimeImageLabels,
} from '../utils/container-image-dockerfile-labels';
import { validateContainerImageBuildReference } from '../utils/container-image-reference';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageBuildLifecycleService } from './container-image-build-lifecycle.service';
import { ContainerImageGappsCacheService } from './container-image-gapps-cache.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { ContainerImageGappsPackageService } from './container-image-gapps-package.service';
import { ContainerImageGappsPresetService } from './container-image-gapps-preset.service';
import { ContainerImageGappsSourceService } from './container-image-gapps-source.service';
import { ContainerImageGappsWorkerService } from './container-image-gapps-worker.service';

type GappsImageStartup = { entrypoint: string[]; cmd: string[] };
type GappsStaging = {
  workDirectory: string | null;
  temporaryPackage: string | null;
};

const gappsRuntimeMetadata = (androidVersion: string) =>
  ({
    runtimeKind: 'redroid',
    androidVersion,
    architecture: 'amd64',
    gmsMode: 'gapps',
    signatureSpoofing: 'not_applicable',
  }) as const;

const setupWizardProperty = 'ro.setupwizard.mode=';
const gappsQueueRetryMs = 5_000;

@Injectable()
export class ContainerImageGappsBuilderService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContainerImageGappsBuilderService.name);
  private readonly cacheOperations = new KeyedSerialQueue<string | null>();
  private draining = false;
  private drainRequested = false;
  private retryTimer?: NodeJS.Timeout;
  private stopping = false;

  constructor(
    private readonly jobs: ContainerImageBuildJobService,
    private readonly presets: ContainerImageGappsPresetService,
    private readonly sources: ContainerImageGappsSourceService,
    private readonly cache: ContainerImageGappsCacheService,
    private readonly worker: ContainerImageGappsWorkerService,
    private readonly packages: ContainerImageGappsPackageService,
    private readonly archive: ContainerImageBuildArchiveService,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_IMAGE_RUNTIME_METADATA)
    private readonly metadata: DockerImageRuntimeMetadataPort,
    private readonly features: FeatureFlagsService,
    private readonly lifecycle: ContainerImageBuildLifecycleService,
  ) {}

  async onModuleInit() {
    await this.jobs.failInterruptedJobs();
    this.scheduleDrain();
  }

  onModuleDestroy() {
    this.stopping = true;
    clearTimeout(this.retryTimer);
  }

  async startBuild(dto: StartGappsBuildDto) {
    this.features.assertEnabled('feature.image-builder');
    const resources = await this.presets.list();
    if (!resources.resources.canBuild) {
      throw new ConflictException(resources.resources.messages.join(' '));
    }
    const preset = this.presets.getPreset(dto.androidVersion);
    const targetImage = validateContainerImageBuildReference(
      dto.targetImage ?? preset.defaultTargetImage,
      'Target image',
    );
    if (targetImage.includes('@')) {
      throw new ConflictException('Target image must use a writable tag.');
    }
    const dockerfile = this.dockerfile(preset.baseImage, dto.androidVersion);
    const job = await this.jobs.createQueuedJob({
      recipeId: null,
      targetImage,
      baseImage: preset.baseImage,
      ...gappsRuntimeMetadata(dto.androidVersion),
      dockerfile,
      contextFileIds: [],
      buildKind: 'redroid_gapps_patch',
      phase: 'queued',
    });
    this.scheduleDrain();
    return job;
  }

  async clearCache(androidVersion: string) {
    if (this.lifecycle.hasActiveGappsBuild(androidVersion)) {
      throw new ConflictException(
        `Cannot clear Android ${androidVersion} cache during an active build.`,
      );
    }
    return this.cacheOperations.run(androidVersion, () =>
      this.cache.clear(androidVersion),
    );
  }

  private scheduleDrain() {
    if (this.stopping || this.retryTimer) return;
    this.drainRequested = true;
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => {
      void this.drain()
        .catch((error) => {
          this.logger.error(
            `GApps build queue failed: ${getErrorMessage(error)}`,
          );
          this.retryDrain();
        })
        .finally(() => {
          this.draining = false;
          if (this.drainRequested) this.scheduleDrain();
        });
    });
  }

  private retryDrain() {
    if (this.stopping || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.scheduleDrain();
    }, gappsQueueRetryMs).unref();
  }

  private async drain() {
    while (!this.stopping) {
      this.drainRequested = false;
      const job = await this.jobs.findNextQueuedGappsJob();
      if (!job && !this.lifecycle.hasActiveGappsBuild()) return;
      if (!(await this.lifecycle.confirmGappsSlotAvailable())) {
        this.retryDrain();
        return;
      }
      if (this.stopping) return;
      if (job) await this.runBuild(job);
      else if (!this.drainRequested) return;
    }
  }

  private runBuild(job: ContainerImageBuildJob) {
    const staging: GappsStaging = {
      workDirectory: null,
      temporaryPackage: null,
    };
    return this.lifecycle.run(
      job,
      (signal) =>
        this.cacheOperations.run(job.androidVersion, () => {
          signal.throwIfAborted();
          return this.build(job, signal, staging);
        }),
      () => this.cleanupStaging(staging),
    );
  }

  private async build(
    job: ContainerImageBuildJob,
    signal: AbortSignal,
    staging: GappsStaging,
  ) {
    const { id } = job;
    const androidVersion = job.androidVersion as SupportedGappsAndroidVersion;
    const preset = this.presets.getPreset(androidVersion);

    await this.jobs.updateBuildDetails(id, { phase: 'pulling_base' });
    signal.throwIfAborted();
    await this.images.pullImage(job.baseImage, (message) => {
      this.jobs.recordProgress(id, message);
    });
    signal.throwIfAborted();
    const baseInspect = await this.images.inspectImage(job.baseImage);
    const resolvedBaseDigest = baseInspect.RepoDigests?.[0] ?? baseInspect.Id;
    const baseEntrypoint = baseInspect.Config?.Entrypoint;
    if (!Array.isArray(baseEntrypoint) || baseEntrypoint[0] !== '/init') {
      throw new Error(`Base image ${job.baseImage} must start ReDroid /init.`);
    }
    const startup: GappsImageStartup = {
      entrypoint: [
        ...baseEntrypoint.filter((arg) => !arg.startsWith(setupWizardProperty)),
        `${setupWizardProperty}DISABLED`,
      ],
      cmd: baseInspect.Config?.Cmd ?? [],
    };
    const pinnedDockerfile = this.dockerfile(
      resolvedBaseDigest,
      androidVersion,
      startup,
    );
    await this.jobs.updateBuildDetails(id, {
      resolvedBaseDigest,
      dockerfile: pinnedDockerfile,
      phase: 'resolving_sources',
    });
    signal.throwIfAborted();
    const revision = await this.sources.resolveRevision(preset.sourceBranch);
    await this.jobs.updateBuildDetails(id, { mindTheGappsRevision: revision });
    let cached = await this.cache.findVerified(androidVersion, revision);
    let packagePath: string;
    if (cached) {
      await this.jobs.updateBuildDetails(id, {
        cacheState: 'hit',
        packageSha256: cached.sha256,
      });
      await this.jobs.appendLog(id, 'Using verified cached GApps package.');
      packagePath = cached.packagePath;
    } else {
      await this.jobs.updateBuildDetails(id, {
        phase: 'building_gapps',
        cacheState: 'miss',
      });
      signal.throwIfAborted();
      staging.temporaryPackage = await this.worker.buildPackage(
        id,
        preset,
        revision,
        signal,
      );
      signal.throwIfAborted();
      const packageSha256 = await this.cache.calculateSha256(
        staging.temporaryPackage,
      );
      await this.jobs.updateBuildDetails(id, {
        packageSha256,
      });
      packagePath = staging.temporaryPackage;
    }

    await this.jobs.updateBuildDetails(id, { phase: 'validating_payload' });
    signal.throwIfAborted();
    const workDirectory = await this.packages.extract(packagePath, id);
    staging.workDirectory = workDirectory;
    signal.throwIfAborted();
    const payloadValidation = await this.packages.validate(workDirectory);
    signal.throwIfAborted();
    if (staging.temporaryPackage) {
      cached = await this.cache.promote(
        staging.temporaryPackage,
        androidVersion,
        revision,
      );
      staging.temporaryPackage = null;
      await this.jobs.updateBuildDetails(id, {
        cacheState: 'built',
        packageSha256: cached.sha256,
      });
    }
    await this.jobs.updateBuildDetails(id, {
      validationResults: { payload: payloadValidation },
      phase: 'building_image',
    });
    signal.throwIfAborted();
    await this.buildImage(
      job.id,
      job.targetImage,
      pinnedDockerfile,
      workDirectory,
      signal,
    );

    await this.jobs.updateBuildDetails(id, { phase: 'validating_image' });
    signal.throwIfAborted();
    const inspect = await this.images.inspectImage(job.targetImage);
    const imageValidation = this.validateImage(
      job.targetImage,
      androidVersion,
      inspect,
      startup,
    );
    await this.jobs.updateBuildDetails(id, {
      validationResults: {
        payload: payloadValidation,
        image: imageValidation,
      },
    });
    signal.throwIfAborted();
    await this.metadata.upsert({
      imageRef: job.targetImage,
      imageId: inspect.Id,
      ...gappsRuntimeMetadata(androidVersion),
    });
    await this.cache.retainOnly(androidVersion, revision).catch((error) => {
      this.logger.warn(
        `Could not prune older Android ${androidVersion} GApps caches: ${getErrorMessage(error)}`,
      );
    });
    return inspect.Id;
  }

  private async cleanupStaging({
    temporaryPackage,
    workDirectory,
  }: GappsStaging) {
    try {
      if (temporaryPackage) await this.cache.removeTemporary(temporaryPackage);
    } finally {
      if (workDirectory) await this.packages.cleanup(workDirectory);
    }
  }

  private async buildImage(
    jobId: string,
    targetImage: string,
    dockerfile: string,
    workDirectory: string,
    signal: AbortSignal,
  ) {
    const context = this.archive.createDirectoryTar(dockerfile, workDirectory);
    await this.images.buildImage({
      context,
      targetImage,
      operationName: 'container_image_gapps_patch',
      description: `Build GApps image ${targetImage}`,
      timeoutMs: 60 * 60 * 1000,
      signal,
      onProgress: (message) => {
        this.jobs.recordProgress(jobId, message);
      },
    });
  }

  private validateImage(
    targetImage: string,
    androidVersion: SupportedGappsAndroidVersion,
    inspect: Awaited<ReturnType<DockerImageRuntimePort['inspectImage']>>,
    startup: GappsImageStartup,
  ) {
    if (!inspect.RepoTags?.includes(targetImage)) {
      throw new Error(`Built image is missing expected tag ${targetImage}.`);
    }
    if (
      JSON.stringify(inspect.Config?.Entrypoint) !==
        JSON.stringify(startup.entrypoint) ||
      JSON.stringify(inspect.Config?.Cmd ?? []) !== JSON.stringify(startup.cmd)
    ) {
      throw new Error(
        `Built image ${targetImage} has an unexpected startup command.`,
      );
    }
    const labels = inspect.Config?.Labels ?? {};
    const expected = requiredRuntimeImageLabels(
      gappsRuntimeMetadata(androidVersion),
    );
    for (const [key, value] of Object.entries(expected)) {
      if (labels[key] !== value) {
        throw new Error(`Built image is missing required label ${key}.`);
      }
    }
    return {
      imageId: inspect.Id,
      tag: targetImage,
      managedLabel: labels[runtimeImageLabelKeys.managed],
    };
  }

  private dockerfile(
    baseImage: string,
    androidVersion: string,
    startup?: GappsImageStartup,
  ) {
    const instructions = [
      `FROM ${baseImage}`,
      'USER 0:0',
      'COPY system/ /system/',
    ];
    if (startup) {
      instructions.push(`ENTRYPOINT ${JSON.stringify(startup.entrypoint)}`);
      // Setting ENTRYPOINT clears any CMD inherited from the base image.
      if (startup.cmd.length > 0) {
        instructions.push(`CMD ${JSON.stringify(startup.cmd)}`);
      }
    }
    return dockerfileWithRequiredLabels(
      instructions.join('\n'),
      requiredRuntimeImageLabels(gappsRuntimeMetadata(androidVersion)),
    );
  }
}
