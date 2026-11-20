import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
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
import { runtimeImageLabelKeys } from '@rebroid/android-application-core/redroid-runtime';
import {
  dockerfileWithRequiredLabels,
  requiredRuntimeImageLabels,
} from '../utils/container-image-dockerfile-labels';
import { validateContainerImageBuildReference } from '../utils/container-image-reference';
import { ContainerImageBuildArchiveService } from './container-image-build-archive.service';
import { ContainerImageBuildJobService } from './container-image-build-job.service';
import { ContainerImageGappsCacheService } from './container-image-gapps-cache.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { ContainerImageGappsPackageService } from './container-image-gapps-package.service';
import { ContainerImageGappsPresetService } from './container-image-gapps-preset.service';
import { ContainerImageGappsSourceService } from './container-image-gapps-source.service';
import { ContainerImageGappsWorkerService } from './container-image-gapps-worker.service';

type GappsImageStartup = { entrypoint: string[]; cmd: string[] };

const setupWizardProperty = 'ro.setupwizard.mode=';

@Injectable()
export class ContainerImageGappsBuilderService implements OnModuleInit {
  private readonly logger = new Logger(ContainerImageGappsBuilderService.name);
  private readonly active = new Map<string, AbortController>();
  private draining = false;

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
  ) {}

  async onModuleInit() {
    await this.jobs.failInterruptedJobs();
    this.scheduleDrain();
  }

  activeBuildIds() {
    return [...this.active.keys()];
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
      runtimeKind: 'redroid',
      androidVersion: dto.androidVersion,
      architecture: 'amd64',
      gmsMode: 'gapps',
      signatureSpoofing: 'not_applicable',
      dockerfile,
      contextFileIds: [],
      buildKind: 'redroid_gapps_patch',
      phase: 'queued',
    });
    this.scheduleDrain();
    return job;
  }

  async cancelBuild(id: string) {
    const job = await this.jobs.getJob(id);
    if (this.jobs.isTerminal(job.status)) return job;
    const active = this.active.get(id);
    if (active) {
      active.abort(new Error('GApps image build cancelled.'));
    }
    const cancelled = await this.jobs.markCancelled(job);
    this.scheduleDrain();
    return cancelled;
  }

  async clearCache(androidVersion: string) {
    const active = [...this.active.keys()];
    for (const id of active) {
      const job = await this.jobs.getJob(id);
      if (job.androidVersion === androidVersion) {
        throw new ConflictException(
          `Cannot clear Android ${androidVersion} cache during an active build.`,
        );
      }
    }
    return this.cache.clear(androidVersion);
  }

  private scheduleDrain() {
    queueMicrotask(() => {
      void this.drain().catch((error) => {
        this.logger.error(
          `GApps build queue failed: ${getErrorMessage(error)}`,
        );
      });
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (true) {
        const job = await this.jobs.findNextQueuedGappsJob();
        if (!job) break;
        await this.runBuild(job.id);
      }
    } finally {
      this.draining = false;
    }
  }

  private async runBuild(id: string) {
    const job = await this.jobs.getJob(id);
    if (job.status !== 'queued') return;
    const active = new AbortController();
    this.active.set(id, active);
    let workDirectory: string | null = null;
    let temporaryPackage: string | null = null;
    try {
      const runningJob = await this.jobs.markRunning(job);
      if (runningJob.status !== 'running') return;
      const androidVersion = job.androidVersion as SupportedGappsAndroidVersion;
      const preset = this.presets.getPreset(androidVersion);

      await this.jobs.updateGappsDetails(job, { phase: 'pulling_base' });
      await this.images.pullImage(job.baseImage, (message) => {
        this.jobs.recordProgress(id, message);
      });
      const baseInspect = await this.images.inspectImage(job.baseImage);
      const resolvedBaseDigest = baseInspect.RepoDigests?.[0] ?? baseInspect.Id;
      const baseEntrypoint = baseInspect.Config?.Entrypoint;
      if (!Array.isArray(baseEntrypoint) || baseEntrypoint[0] !== '/init') {
        throw new Error(
          `Base image ${job.baseImage} must start ReDroid /init.`,
        );
      }
      const startup: GappsImageStartup = {
        entrypoint: [
          ...baseEntrypoint.filter(
            (arg) => !arg.startsWith(setupWizardProperty),
          ),
          `${setupWizardProperty}DISABLED`,
        ],
        cmd: baseInspect.Config?.Cmd ?? [],
      };
      const pinnedDockerfile = this.dockerfile(
        resolvedBaseDigest,
        androidVersion,
        startup,
      );
      await this.jobs.updateGappsDetails(job, {
        resolvedBaseDigest,
        dockerfile: pinnedDockerfile,
      });

      await this.jobs.updateGappsDetails(job, { phase: 'resolving_sources' });
      const revision = await this.sources.resolveRevision(preset.sourceBranch);
      await this.jobs.updateGappsDetails(job, { sourceRevision: revision });
      let cached = await this.cache.findVerified(androidVersion, revision);
      let packagePath: string;
      if (cached) {
        await this.jobs.updateGappsDetails(job, {
          cacheState: 'hit',
          packageSha256: cached.sha256,
        });
        await this.jobs.appendLog(id, 'Using verified cached GApps package.');
        packagePath = cached.packagePath;
      } else {
        await this.jobs.updateGappsDetails(job, {
          phase: 'building_gapps',
          cacheState: 'miss',
        });
        active.signal.throwIfAborted();
        temporaryPackage = await this.worker.buildPackage(
          id,
          preset,
          revision,
          active.signal,
        );
        const packageSha256 =
          await this.cache.calculateSha256(temporaryPackage);
        await this.jobs.updateGappsDetails(job, {
          packageSha256,
        });
        packagePath = temporaryPackage;
      }

      active.signal.throwIfAborted();
      await this.jobs.updateGappsDetails(job, { phase: 'validating_payload' });
      workDirectory = await this.packages.extract(packagePath, id);
      const payloadValidation = await this.packages.validate(workDirectory);
      if (temporaryPackage) {
        cached = await this.cache.promote(
          temporaryPackage,
          androidVersion,
          revision,
        );
        temporaryPackage = null;
        await this.jobs.updateGappsDetails(job, {
          cacheState: 'built',
          packageSha256: cached.sha256,
        });
      }
      await this.jobs.updateGappsDetails(job, {
        validationResults: { payload: payloadValidation },
      });

      active.signal.throwIfAborted();
      await this.jobs.updateGappsDetails(job, { phase: 'building_image' });
      await this.buildImage(
        job.id,
        job.targetImage,
        pinnedDockerfile,
        workDirectory,
        active.signal,
      );

      active.signal.throwIfAborted();
      await this.jobs.updateGappsDetails(job, { phase: 'validating_image' });
      const inspect = await this.images.inspectImage(job.targetImage);
      const imageValidation = this.validateImage(
        job.targetImage,
        androidVersion,
        inspect,
        startup,
      );
      const current = await this.jobs.getJob(id);
      await this.jobs.updateGappsDetails(current, {
        validationResults: {
          payload: payloadValidation,
          image: imageValidation,
        },
      });
      await this.metadata.upsert({
        imageRef: job.targetImage,
        imageId: inspect.Id,
        runtimeKind: 'redroid',
        androidVersion,
        architecture: 'amd64',
        gmsMode: 'gapps',
        signatureSpoofing: 'not_applicable',
      });
      await this.cache.retainOnly(androidVersion, revision).catch((error) => {
        this.logger.warn(
          `Could not prune older Android ${androidVersion} GApps caches: ${getErrorMessage(error)}`,
        );
      });
      const finalJob = await this.jobs.getJob(id);
      if (finalJob.status !== 'cancelled' && !active.signal.aborted) {
        await this.jobs.markSucceeded(finalJob, inspect.Id);
      }
    } catch (error) {
      const current = await this.jobs.getJob(id);
      if (current.status === 'cancelled' || active.signal.aborted) {
        if (current.status !== 'cancelled')
          await this.jobs.markCancelled(current);
      } else {
        await this.jobs.markFailed(current, getErrorMessage(error));
      }
    } finally {
      try {
        if (temporaryPackage)
          await this.cache.removeTemporary(temporaryPackage);
      } finally {
        try {
          if (workDirectory) await this.packages.cleanup(workDirectory);
        } finally {
          this.active.delete(id);
        }
      }
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
    const expected = requiredRuntimeImageLabels({
      runtimeKind: 'redroid',
      androidVersion,
      architecture: 'amd64',
      gmsMode: 'gapps',
      signatureSpoofing: 'not_applicable',
    });
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
    const metadata = {
      runtimeKind: 'redroid' as const,
      androidVersion,
      architecture: 'amd64',
      gmsMode: 'gapps' as const,
      signatureSpoofing: 'not_applicable' as const,
    };
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
      requiredRuntimeImageLabels(metadata),
    );
  }
}
