import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Readable } from 'node:stream';
import { Repository } from 'typeorm';
import { getErrorMessage } from '../../common/error-message';
import { DockerEngineService } from '../../docker/docker-engine.service';
import { DockerImageRuntimeMetadataService } from '../../docker/images/services/docker-image-runtime-metadata.service';
import { DockerImageRuntimeService } from '../../docker/images/services/docker-image-runtime.service';
import { StartContainerImageBuildDto } from '../dto/container-image-build.dto';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import type { ContainerImageBuildStatus } from '../entities/container-image-build-status';
import { ContainerImageBuildContextService } from './container-image-build-context.service';
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

const terminalStatuses: ContainerImageBuildStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
];
const logTailMaxLength = 60_000;

const cleanNullable = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

@Injectable()
export class ContainerImageBuilderService {
  private readonly logger = new Logger(ContainerImageBuilderService.name);
  private readonly activeBuilds = new Map<string, ActiveBuild>();

  constructor(
    @InjectRepository(ContainerImageBuildJob)
    private readonly jobs: Repository<ContainerImageBuildJob>,
    private readonly engine: DockerEngineService,
    private readonly images: DockerImageRuntimeService,
    private readonly metadata: DockerImageRuntimeMetadataService,
    private readonly context: ContainerImageBuildContextService,
  ) {}

  listJobs() {
    return this.jobs.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  async getJob(id: string) {
    const job = await this.jobs.findOneBy({ id });
    if (!job) {
      throw new NotFoundException('Container image build job not found.');
    }
    return job;
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
    const job = await this.jobs.save(
      this.jobs.create({
        recipeId: cleanNullable(dto.recipeId),
        targetImage,
        baseImage,
        status: 'queued',
        runtimeKind: metadata.runtimeKind,
        androidVersion: metadata.androidVersion,
        architecture: metadata.architecture,
        gmsMode: metadata.gmsMode,
        signatureSpoofing: metadata.signatureSpoofing,
        dockerfile,
        contextFileIdsJson: JSON.stringify(contextFileIds),
        logTail: 'Build queued.',
        imageId: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      }),
    );

    void this.runBuild(job.id).catch((error) => {
      this.logger.error(
        `Image build ${job.id} crashed: ${getErrorMessage(error)}`,
      );
    });
    return job;
  }

  async cancelBuild(id: string) {
    const job = await this.getJob(id);
    if (terminalStatuses.includes(job.status)) {
      return job;
    }

    const active = this.activeBuilds.get(id);
    if (active) {
      active.cancelled = true;
      active.stream?.destroy(new Error('Container image build cancelled.'));
    }

    job.status = 'cancelled';
    job.finishedAt = new Date();
    job.logTail = this.nextLogTail(job.logTail, 'Build cancelled.');
    return this.jobs.save(job);
  }

  private async runBuild(id: string) {
    const job = await this.getJob(id);
    if (job.status === 'cancelled') {
      return;
    }

    const active: ActiveBuild = { cancelled: false };
    this.activeBuilds.set(id, active);
    job.status = 'running';
    job.startedAt = new Date();
    job.logTail = this.nextLogTail(job.logTail, 'Build started.');
    await this.jobs.save(job);

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
      const buildContext = await this.context.createTar(
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
                  void this.appendLog(id, message);
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
      current.status = 'succeeded';
      current.imageId = inspect.Id;
      current.finishedAt = new Date();
      current.logTail = this.nextLogTail(
        current.logTail,
        `Build succeeded: ${inspect.Id}`,
      );
      await this.jobs.save(current);
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
        current.status = 'cancelled';
        current.finishedAt = current.finishedAt ?? new Date();
        current.logTail = this.nextLogTail(current.logTail, 'Build cancelled.');
        await this.jobs.save(current);
        return;
      }

      const message = getErrorMessage(error);
      current.status = 'failed';
      current.error = message;
      current.finishedAt = new Date();
      current.logTail = this.nextLogTail(
        current.logTail,
        `Build failed: ${message}`,
      );
      await this.jobs.save(current);
    } finally {
      this.activeBuilds.delete(id);
    }
  }

  private async appendLog(id: string, message: string) {
    const job = await this.jobs.findOneBy({ id });
    if (!job || terminalStatuses.includes(job.status)) {
      return;
    }

    job.logTail = this.nextLogTail(job.logTail, message);
    await this.jobs.save(job);
  }

  private nextLogTail(current: string, message: string) {
    const next = `${current ? `${current}\n` : ''}${message.trim()}`.trim();
    return next.length > logTailMaxLength
      ? next.slice(next.length - logTailMaxLength)
      : next;
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
