import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import type { ContainerImageBuildStatus } from '../entities/container-image-build-status';

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
        runtimeKind: input.runtimeKind,
        androidVersion: input.androidVersion,
        architecture: input.architecture,
        gmsMode: input.gmsMode,
        signatureSpoofing: input.signatureSpoofing,
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

  markRunning(job: ContainerImageBuildJob) {
    job.status = 'running';
    job.startedAt = new Date();
    job.logTail = this.nextLogTail(job.logTail, 'Build started.');
    return this.jobs.save(job);
  }

  markCancelled(job: ContainerImageBuildJob) {
    job.status = 'cancelled';
    job.finishedAt = job.finishedAt ?? new Date();
    job.logTail = this.nextLogTail(job.logTail, 'Build cancelled.');
    return this.jobs.save(job);
  }

  markSucceeded(job: ContainerImageBuildJob, imageId: string) {
    job.status = 'succeeded';
    job.imageId = imageId;
    job.finishedAt = new Date();
    job.logTail = this.nextLogTail(job.logTail, `Build succeeded: ${imageId}`);
    return this.jobs.save(job);
  }

  markFailed(job: ContainerImageBuildJob, message: string) {
    job.status = 'failed';
    job.error = message;
    job.finishedAt = new Date();
    job.logTail = this.nextLogTail(job.logTail, `Build failed: ${message}`);
    return this.jobs.save(job);
  }

  async appendLog(id: string, message: string) {
    const job = await this.jobs.findOneBy({ id });
    if (!job || this.isTerminal(job.status)) {
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
}
