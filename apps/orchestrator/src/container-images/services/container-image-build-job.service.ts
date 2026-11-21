import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getErrorMessage } from '../../common/error-message';
import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import type { ContainerImageBuildStatus } from '../entities/container-image-build-status';
import type {
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

const unfinishedStatuses: ContainerImageBuildStatus[] = ['queued', 'running'];
const terminalStatuses: ContainerImageBuildStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
];
const logTailMaxLength = 60_000;

@Injectable()
export class ContainerImageBuildJobService {
  private readonly logger = new Logger(ContainerImageBuildJobService.name);

  constructor(
    @InjectRepository(ContainerImageBuildJob)
    private readonly jobs: Repository<ContainerImageBuildJob>,
  ) {}

  listJobs() {
    return this.jobs.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  findLatestJob(buildKind: ContainerImageBuildKind) {
    return this.jobs
      .createQueryBuilder('job')
      .where({ buildKind })
      .orderBy('job.createdAt', 'DESC')
      .addOrderBy('job.rowid', 'DESC')
      .take(1)
      .getOne();
  }

  findNextQueuedGappsJob() {
    return this.jobs.findOne({
      where: { status: 'queued', buildKind: 'redroid_gapps_patch' },
      order: { createdAt: 'ASC' },
    });
  }

  hasUnfinishedGappsJob(id: string) {
    return this.jobs.existsBy({
      id,
      status: In(unfinishedStatuses),
      buildKind: 'redroid_gapps_patch',
    });
  }

  async pruneHistory(cutoff: Date, activeIds: readonly string[]) {
    const rankedJobs = this.jobs
      .createQueryBuilder('job')
      .select('job.id', 'id')
      .addSelect('COALESCE(job.finishedAt, job.updatedAt)', 'completedAt')
      .addSelect(
        `ROW_NUMBER() OVER (
          PARTITION BY job.targetImage
          ORDER BY COALESCE(job.finishedAt, job.updatedAt) DESC,
            job.createdAt DESC, job.id DESC
        )`,
        'resultRank',
      )
      .where('job.status IN (:...terminalStatuses)', { terminalStatuses });
    const deletion = this.jobs
      .createQueryBuilder()
      .delete()
      .where(
        `id IN (SELECT id FROM (${rankedJobs.getQuery()}) AS completed
          WHERE resultRank > 1 AND completedAt < :cutoff)`,
        { cutoff, ...rankedJobs.getParameters() },
      );
    if (activeIds.length) {
      deletion.andWhere('id NOT IN (:...activeIds)', { activeIds });
    }
    const result = await deletion.execute();
    return result.affected ?? 0;
  }

  async failInterruptedJobs() {
    const jobs = await this.jobs.find({
      where: [
        { status: 'running', buildKind: 'redroid_gapps_patch' },
        { status: In(unfinishedStatuses), buildKind: 'dockerfile_overlay' },
      ],
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

  markRunning(job: ContainerImageBuildJob) {
    return this.updateWithLog(job.id, ['queued'], 'Build started.', {
      status: 'running',
      startedAt: new Date(),
    });
  }

  async updateBuildDetails(
    id: string,
    details: Partial<
      Pick<
        ContainerImageBuildJob,
        | 'phase'
        | 'resolvedBaseDigest'
        | 'mindTheGappsRevision'
        | 'packageSha256'
        | 'cacheState'
        | 'validationResults'
        | 'dockerfile'
      >
    >,
  ) {
    const result = await this.jobs.update(
      { id, status: 'running' },
      details as Parameters<Repository<ContainerImageBuildJob>['update']>[1],
    );
    if (result.affected !== 1) {
      throw new Error(`Image build ${id} is no longer running.`);
    }
  }

  async markCancelled(job: ContainerImageBuildJob) {
    await this.updateWithLog(job.id, unfinishedStatuses, 'Build cancelled.', {
      status: 'cancelled',
      finishedAt: job.finishedAt ?? new Date(),
    });
    return this.getJob(job.id);
  }

  async markSucceeded(job: ContainerImageBuildJob, imageId: string) {
    await this.updateWithLog(
      job.id,
      ['running'],
      `Build succeeded: ${imageId}`,
      {
        status: 'succeeded',
        imageId,
        finishedAt: new Date(),
        phase: 'complete',
      },
    );
    return this.getJob(job.id);
  }

  async markFailed(job: ContainerImageBuildJob, message: string) {
    await this.updateWithLog(
      job.id,
      unfinishedStatuses,
      `Build failed: ${message}`,
      {
        status: 'failed',
        error: message,
        finishedAt: new Date(),
      },
    );
    return this.getJob(job.id);
  }

  appendLog(id: string, message: string) {
    return this.updateWithLog(id, unfinishedStatuses, message);
  }

  recordProgress(id: string, message: string) {
    void this.appendLog(id, message).catch((error: unknown) => {
      this.logger.warn(
        `Could not save progress for image build ${id}: ${getErrorMessage(error)}`,
      );
    });
  }

  private updateWithLog(
    id: string,
    expectedStatuses: ContainerImageBuildStatus[],
    message: string,
    patch: Parameters<Repository<ContainerImageBuildJob>['update']>[1] = {},
  ) {
    return this.jobs.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ContainerImageBuildJob);
      const job = await repository.findOne({
        where: { id },
        select: { status: true, logTail: true },
      });
      if (!job || !expectedStatuses.includes(job.status)) return false;

      const result = await repository.update(
        { id, status: job.status },
        { ...patch, logTail: this.nextLogTail(job.logTail, message) },
      );
      return result.affected === 1;
    });
  }

  private nextLogTail(current: string, message: string) {
    const next = `${current ? `${current}\n` : ''}${message.trim()}`.trim();
    return next.length > logTailMaxLength
      ? next.slice(next.length - logTailMaxLength)
      : next;
  }
}
