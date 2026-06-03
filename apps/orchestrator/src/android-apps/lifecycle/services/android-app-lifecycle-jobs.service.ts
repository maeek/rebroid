import { Injectable } from '@nestjs/common';
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
    const existing = await this.jobs.findByApplicationAndKind(
      applicationId,
      kind,
    );
    const job =
      existing ??
      this.jobs.create({
        applicationId,
        kind,
        attempts: 0,
      });
    job.status = AndroidAppLifecycleJobStatus.Pending;
    job.payloadJson = payload ? JSON.stringify(payload) : null;
    job.lastError = null;
    try {
      return await this.jobs.save(job);
    } catch (error) {
      const concurrent = await this.jobs.findByApplicationAndKind(
        applicationId,
        kind,
      );
      if (!concurrent) throw error;
      concurrent.status = AndroidAppLifecycleJobStatus.Pending;
      concurrent.payloadJson = job.payloadJson;
      concurrent.lastError = null;
      return this.jobs.save(concurrent);
    }
  }

  async markRunning(applicationId: string, kind: AndroidAppLifecycleJobKind) {
    const job = await this.findOrCreate(applicationId, kind);
    job.status = AndroidAppLifecycleJobStatus.Running;
    job.attempts += 1;
    return this.jobs.save(job);
  }

  async markFailed(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    error: string,
  ) {
    const job = await this.findOrCreate(applicationId, kind);
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

  listPending() {
    return this.jobs.listPending();
  }

  private async findOrCreate(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
  ) {
    return (
      (await this.jobs.findByApplicationAndKind(applicationId, kind)) ??
      this.jobs.create({ applicationId, kind, attempts: 0 })
    );
  }
}
