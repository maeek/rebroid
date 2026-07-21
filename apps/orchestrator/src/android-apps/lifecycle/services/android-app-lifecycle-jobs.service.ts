import { ConflictException, Injectable } from '@nestjs/common';
import { AndroidAppLifecycleJobsRepository } from '../../persistence/android-app-lifecycle-jobs.repository';
import {
  AndroidAppLifecycleJobKind,
  AndroidAppLifecycleJobStatus,
} from '../entities/android-app-lifecycle-job.entity';

@Injectable()
export class AndroidAppLifecycleJobsService {
  constructor(private readonly jobs: AndroidAppLifecycleJobsRepository) {}

  async enqueue(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    payload?: Record<string, unknown>,
  ) {
    const existing = await this.jobs.findByApplication(applicationId);
    const job =
      existing ??
      this.jobs.create({
        applicationId,
        kind,
        attempts: 0,
      });
    job.kind = kind;
    job.status = AndroidAppLifecycleJobStatus.Pending;
    job.payloadJson = payload ? JSON.stringify(payload) : null;
    job.lastError = null;
    try {
      return await this.jobs.save(job);
    } catch (error) {
      const concurrent = await this.jobs.findByApplication(applicationId);
      if (!concurrent) throw error;
      concurrent.kind = kind;
      concurrent.status = AndroidAppLifecycleJobStatus.Pending;
      concurrent.payloadJson = job.payloadJson;
      concurrent.lastError = null;
      return this.jobs.save(concurrent);
    }
  }

  async markRunning(applicationId: string, kind: AndroidAppLifecycleJobKind) {
    const job = await this.findActive(applicationId, kind);
    job.status = AndroidAppLifecycleJobStatus.Running;
    job.attempts += 1;
    return this.jobs.save(job);
  }

  async markFailed(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    error: string,
  ) {
    const job = await this.findActive(applicationId, kind);
    job.status = AndroidAppLifecycleJobStatus.Pending;
    job.lastError = error;
    return this.jobs.save(job);
  }

  async complete(applicationId: string, kind: AndroidAppLifecycleJobKind) {
    await this.jobs.deleteByApplicationAndKind(applicationId, kind);
  }

  async removeForApplication(applicationId: string) {
    await this.jobs.deleteByApplication(applicationId);
  }

  listActive() {
    return this.jobs.listActive();
  }

  private async findActive(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
  ) {
    const job = await this.jobs.findByApplication(applicationId);
    if (!job) {
      throw new ConflictException(
        `No active ${kind} lifecycle job exists for application "${applicationId}".`,
      );
    }
    if (job.kind !== kind) {
      throw new ConflictException(
        `Application "${applicationId}" is reserved by a ${job.kind} lifecycle job.`,
      );
    }
    return job;
  }
}
