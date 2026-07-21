import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import type Dockerode from 'dockerode';
import { getErrorMessage } from '../../common/error-message';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../docker/contracts/docker-engine.port';
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

type DockerProgressEvent = {
  stream?: string;
  status?: string;
  progress?: string;
  id?: string;
  error?: string;
  errorDetail?: { message?: string };
};

type ActiveGappsBuild = {
  cancelled: boolean;
  stream?: Readable;
};

const entrypoint = Buffer.from(`#!/system/bin/sh
(
  until [ "$(getprop sys.boot_completed)" = "1" ]; do sleep 2; done
  pm disable-user --user 0 com.google.android.setupwizard >/dev/null 2>&1 || true
) &
exec "$@"
`);

@Injectable()
export class ContainerImageGappsBuilderService implements OnModuleInit {
  private readonly logger = new Logger(ContainerImageGappsBuilderService.name);
  private readonly active = new Map<string, ActiveGappsBuild>();
  private draining = false;

  constructor(
    private readonly jobs: ContainerImageBuildJobService,
    private readonly presets: ContainerImageGappsPresetService,
    private readonly sources: ContainerImageGappsSourceService,
    private readonly cache: ContainerImageGappsCacheService,
    private readonly worker: ContainerImageGappsWorkerService,
    private readonly packages: ContainerImageGappsPackageService,
    private readonly archive: ContainerImageBuildArchiveService,
    @Inject(DOCKER_ENGINE) private readonly engine: DockerEnginePort,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_IMAGE_RUNTIME_METADATA)
    private readonly metadata: DockerImageRuntimeMetadataPort,
    private readonly features: FeatureFlagsService,
  ) {}

  async onModuleInit() {
    await this.jobs.failInterruptedGappsJobs();
    this.scheduleDrain();
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
      active.cancelled = true;
      active.stream?.destroy(new Error('GApps image build cancelled.'));
      await this.worker.cancel(id);
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
    const active: ActiveGappsBuild = { cancelled: false };
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
        void this.jobs.appendLog(id, message);
      });
      const baseInspect = await this.images.inspectImage(job.baseImage);
      const resolvedBaseDigest = baseInspect.RepoDigests?.[0] ?? baseInspect.Id;
      const pinnedDockerfile = this.dockerfile(
        resolvedBaseDigest,
        androidVersion,
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
        temporaryPackage = await this.worker.buildPackage(id, preset, revision);
        const packageSha256 =
          await this.cache.calculateSha256(temporaryPackage);
        await this.jobs.updateGappsDetails(job, {
          packageSha256,
        });
        packagePath = temporaryPackage;
      }

      this.throwIfCancelled(active);
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

      this.throwIfCancelled(active);
      await this.jobs.updateGappsDetails(job, { phase: 'building_image' });
      await this.buildImage(
        job.id,
        job.targetImage,
        pinnedDockerfile,
        workDirectory,
        active,
      );

      this.throwIfCancelled(active);
      await this.jobs.updateGappsDetails(job, { phase: 'validating_image' });
      const inspect = await this.images.inspectImage(job.targetImage);
      const imageValidation = this.validateImage(
        job.targetImage,
        androidVersion,
        inspect,
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
      if (finalJob.status !== 'cancelled' && !active.cancelled) {
        await this.jobs.markSucceeded(finalJob, inspect.Id);
      }
    } catch (error) {
      const current = await this.jobs.getJob(id);
      if (current.status === 'cancelled' || active.cancelled) {
        if (current.status !== 'cancelled')
          await this.jobs.markCancelled(current);
      } else {
        await this.jobs.markFailed(current, getErrorMessage(error));
      }
    } finally {
      if (temporaryPackage) await this.cache.removeTemporary(temporaryPackage);
      if (workDirectory) await this.packages.cleanup(workDirectory);
      this.active.delete(id);
    }
  }

  private async buildImage(
    jobId: string,
    targetImage: string,
    dockerfile: string,
    workDirectory: string,
    active: ActiveGappsBuild,
  ) {
    const context = this.archive.createDirectoryTar(dockerfile, workDirectory, {
      'rebroid-gapps-entrypoint': entrypoint,
    });
    await this.engine.longOperation(
      'container_image_gapps_patch',
      `Build GApps image ${targetImage}`,
      async (docker, signal) => {
        const stream = (await docker.buildImage(context, {
          t: targetImage,
          abortSignal: signal,
        })) as unknown as Readable;
        active.stream = stream;
        const abort = () =>
          stream.destroy(new Error('GApps image build aborted.'));
        signal.addEventListener('abort', abort, { once: true });
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(
            stream,
            (error) => {
              signal.removeEventListener('abort', abort);
              if (error) reject(error);
              else resolve();
            },
            (event: DockerProgressEvent) => {
              const message = this.progressMessage(event);
              if (message) void this.jobs.appendLog(jobId, message);
            },
          );
        });
      },
      60 * 60 * 1000,
    );
  }

  private validateImage(
    targetImage: string,
    androidVersion: SupportedGappsAndroidVersion,
    inspect: Dockerode.ImageInspectInfo,
  ) {
    if (!inspect.RepoTags?.includes(targetImage)) {
      throw new Error(`Built image is missing expected tag ${targetImage}.`);
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

  private dockerfile(baseImage: string, androidVersion: string) {
    const metadata = {
      runtimeKind: 'redroid' as const,
      androidVersion,
      architecture: 'amd64',
      gmsMode: 'gapps' as const,
      signatureSpoofing: 'not_applicable' as const,
    };
    return dockerfileWithRequiredLabels(
      `FROM ${baseImage}
USER root
COPY system/ /system/
COPY --chmod=0755 rebroid-gapps-entrypoint /usr/local/bin/rebroid-gapps-entrypoint
ENTRYPOINT ["/usr/local/bin/rebroid-gapps-entrypoint"]
CMD ["/init"]`,
      requiredRuntimeImageLabels(metadata),
    );
  }

  private throwIfCancelled(active: ActiveGappsBuild) {
    if (active.cancelled) throw new Error('GApps image build cancelled.');
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
