import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import type { ContainerImageBuildStatus } from '../entities/container-image-build-status';
import type {
  ContainerImageBuildCacheState,
  ContainerImageBuildKind,
  ContainerImageGappsBuildPhase,
} from '../entities/container-image-gapps-build';

type QueuedImageBuildJobInput = Pick<
  ContainerImageBuildJob,
  | 'targetImage'
  | 'baseImage'
  | 'runtimeKind'
  | 'androidVersion'
  | 'architecture'
  | 'gmsMode'
  | 'signatureSpoofing'
  | 'dockerfile'
> & {
  contextFileIds: string[];
  recipeId: string | null;
  buildKind?: ContainerImageBuildKind;
  phase?: ContainerImageGappsBuildPhase;
};

const terminalStatuses: ContainerImageBuildStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
];
const logTailMaxLength = 60_000;

@Injectable()
export class ContainerImageBuildJobService {
  constructor(
    @InjectRepository(ContainerImageBuildJob)
    private readonly jobs: Repository<ContainerImageBuildJob>,
  ) {}

  listJobs() {
    return this.jobs.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  findNextQueuedGappsJob() {
    return this.jobs.findOne({
      where: { status: 'queued', buildKind: 'redroid_gapps_patch' },
      order: { createdAt: 'ASC' },
    });
  }

  async failInterruptedGappsJobs() {
    const jobs = await this.jobs.find({
      where: { status: 'running', buildKind: 'redroid_gapps_patch' },
    });
    await Promise.all(
      jobs.map((job) =>
        this.markFailed(job, 'Build interrupted by orchestrator restart.'),
      ),
    );
  }

  async getJob(id: string) {
    const job = await this.jobs.findOneBy({ id });
    if (!job) {
      throw new NotFoundException('Container image build job not found.');
    }
    return job;
  }

  isTerminal(status: ContainerImageBuildStatus) {
    return terminalStatuses.includes(status);
  }

  createQueuedJob(input: QueuedImageBuildJobInput) {
    return this.jobs.save(
      this.jobs.create({
        recipeId: input.recipeId,
        targetImage: input.targetImage,
        baseImage: input.baseImage,
        status: 'queued',
        buildKind: input.buildKind ?? 'dockerfile_overlay',
        phase: input.phase ?? 'queued',
        runtimeKind: input.runtimeKind,
        androidVersion: input.androidVersion,
        architecture: input.architecture,
        gmsMode: input.gmsMode,
        signatureSpoofing: input.signatureSpoofing,
        resolvedBaseDigest: null,
        mindTheGappsRevision: null,
        packageSha256: null,
        cacheState: 'not_applicable',
        validationResults: {},
        dockerfile: input.dockerfile,
        contextFileIdsJson: JSON.stringify(input.contextFileIds),
        logTail: 'Build queued.',
        imageId: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      }),
    );
  }

  async markRunning(job: ContainerImageBuildJob) {
    await this.jobs.update(
      { id: job.id, status: 'queued' },
      {
        status: 'running',
        startedAt: new Date(),
        logTail: this.nextLogTail(job.logTail, 'Build started.'),
      },
    );
    return this.getJob(job.id);
  }

  updateGappsDetails(
    job: ContainerImageBuildJob,
    values: {
      phase?: ContainerImageGappsBuildPhase;
      resolvedBaseDigest?: string;
      sourceRevision?: string;
      packageSha256?: string;
      cacheState?: ContainerImageBuildCacheState;
      validationResults?: Record<string, unknown>;
      dockerfile?: string;
    },
  ) {
    const patch: Partial<ContainerImageBuildJob> = {};
    if (values.phase) patch.phase = values.phase;
    if (values.resolvedBaseDigest) {
      patch.resolvedBaseDigest = values.resolvedBaseDigest;
    }
    if (values.sourceRevision) {
      patch.mindTheGappsRevision = values.sourceRevision;
    }
    if (values.packageSha256) patch.packageSha256 = values.packageSha256;
    if (values.cacheState) patch.cacheState = values.cacheState;
    if (values.validationResults) {
      patch.validationResults = values.validationResults;
    }
    if (values.dockerfile) patch.dockerfile = values.dockerfile;
    return this.jobs
      .update(
        { id: job.id, status: In(['queued', 'running']) },
        patch as Parameters<Repository<ContainerImageBuildJob>['update']>[1],
      )
      .then(() => this.getJob(job.id));
  }

  async markCancelled(job: ContainerImageBuildJob) {
    await this.jobs.update(
      { id: job.id, status: In(['queued', 'running']) },
      {
        status: 'cancelled',
        finishedAt: job.finishedAt ?? new Date(),
        logTail: this.nextLogTail(job.logTail, 'Build cancelled.'),
      },
    );
    return this.getJob(job.id);
  }

  async markSucceeded(job: ContainerImageBuildJob, imageId: string) {
    await this.jobs.update(
      { id: job.id, status: 'running' },
      {
        status: 'succeeded',
        imageId,
        finishedAt: new Date(),
        phase: 'complete',
        logTail: this.nextLogTail(job.logTail, `Build succeeded: ${imageId}`),
      },
    );
    return this.getJob(job.id);
  }

  async markFailed(job: ContainerImageBuildJob, message: string) {
    await this.jobs.update(
      { id: job.id, status: In(['queued', 'running']) },
      {
        status: 'failed',
        error: message,
        finishedAt: new Date(),
        logTail: this.nextLogTail(job.logTail, `Build failed: ${message}`),
      },
    );
    return this.getJob(job.id);
  }

  async appendLog(id: string, message: string) {
    const job = await this.jobs.findOneBy({ id });
    if (!job || this.isTerminal(job.status)) {
      return;
    }

    await this.jobs.update(
      { id, status: In(['queued', 'running']) },
      { logTail: this.nextLogTail(job.logTail, message) },
    );
  }

  private nextLogTail(current: string, message: string) {
    const next = `${current ? `${current}\n` : ''}${message.trim()}`.trim();
    return next.length > logTailMaxLength
      ? next.slice(next.length - logTailMaxLength)
      : next;
  }
}
