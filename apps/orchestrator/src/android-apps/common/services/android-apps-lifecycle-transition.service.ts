import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJob,
  AndroidAppLifecycleJobKind,
  AndroidAppLifecycleJobStatus,
} from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppsLogService } from './android-apps-log.service';
import type { AndroidApplicationLifecyclePatch } from './android-apps-state-writer.service';

const allowedStatusTransitions: Record<
  AndroidApplicationStatus,
  readonly AndroidApplicationStatus[]
> = {
  [AndroidApplicationStatus.Provisioning]: [
    AndroidApplicationStatus.Provisioning,
    AndroidApplicationStatus.Running,
    AndroidApplicationStatus.Stopped,
    AndroidApplicationStatus.Error,
    AndroidApplicationStatus.Removing,
  ],
  [AndroidApplicationStatus.Running]: [
    AndroidApplicationStatus.Running,
    AndroidApplicationStatus.Stopped,
    AndroidApplicationStatus.Error,
    AndroidApplicationStatus.Removing,
  ],
  [AndroidApplicationStatus.Stopped]: [
    AndroidApplicationStatus.Stopped,
    AndroidApplicationStatus.Provisioning,
    AndroidApplicationStatus.Error,
    AndroidApplicationStatus.Removing,
  ],
  [AndroidApplicationStatus.Error]: [
    AndroidApplicationStatus.Error,
    AndroidApplicationStatus.Provisioning,
    AndroidApplicationStatus.Running,
    AndroidApplicationStatus.Stopped,
    AndroidApplicationStatus.Removing,
  ],
  [AndroidApplicationStatus.Removing]: [
    AndroidApplicationStatus.Removing,
    AndroidApplicationStatus.Removed,
    AndroidApplicationStatus.Error,
  ],
  [AndroidApplicationStatus.Removed]: [AndroidApplicationStatus.Removed],
};

type JobPayload = Record<string, unknown> | undefined;

@Injectable()
export class AndroidAppsLifecycleTransitionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logs: AndroidAppsLogService,
  ) {}

  async beginJob(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    patch: AndroidApplicationLifecyclePatch,
    payload?: JobPayload,
    replaceExisting = false,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);

      const repository = manager.getRepository(AndroidAppLifecycleJob);
      const existing = await repository.findOneBy({ applicationId });
      if (existing && existing.kind !== kind && !replaceExisting) {
        throw new ConflictException(
          `Application "${applicationId}" is reserved by a ${existing.kind} lifecycle job.`,
        );
      }

      const job =
        existing ??
        repository.create({
          applicationId,
          attempts: 0,
        });
      job.kind = kind;
      job.status = AndroidAppLifecycleJobStatus.Pending;
      job.payloadJson = payload ? JSON.stringify(payload) : null;
      job.lastError = null;
      await manager.getRepository(AndroidApplication).save(app);
      await repository.save(job);
    });
    await this.logs.appendLifecycle(applicationId, patch);
  }

  async handoffJob(
    applicationId: string,
    currentKind: AndroidAppLifecycleJobKind,
    nextKind: AndroidAppLifecycleJobKind,
    patch: AndroidApplicationLifecyclePatch,
    payload?: JobPayload,
  ) {
    const changed = await this.dataSource.transaction(async (manager) => {
      const job = await manager
        .getRepository(AndroidAppLifecycleJob)
        .findOneBy({ applicationId });
      if (!job || job.kind !== currentKind) {
        return false;
      }

      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      job.kind = nextKind;
      job.status = AndroidAppLifecycleJobStatus.Pending;
      job.payloadJson = payload ? JSON.stringify(payload) : null;
      job.lastError = null;
      await manager.getRepository(AndroidApplication).save(app);
      await manager.getRepository(AndroidAppLifecycleJob).save(job);
      return true;
    });
    if (changed) {
      await this.logs.appendLifecycle(applicationId, patch);
    }
    return changed;
  }

  async completeJob(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const changed = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AndroidAppLifecycleJob);
      const job = await repository.findOneBy({ applicationId });
      if (!job || job.kind !== kind) {
        return false;
      }

      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
      await repository.remove(job);
      return true;
    });
    if (changed) {
      await this.logs.appendLifecycle(applicationId, patch);
    }
    return changed;
  }

  async failJob(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    error: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const changed = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AndroidAppLifecycleJob);
      const job = await repository.findOneBy({ applicationId });
      if (!job || job.kind !== kind) {
        return false;
      }

      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      job.status = AndroidAppLifecycleJobStatus.Pending;
      job.lastError = error;
      await manager.getRepository(AndroidApplication).save(app);
      await repository.save(job);
      return true;
    });
    if (changed) {
      await this.logs.appendLifecycle(applicationId, patch);
    }
    return changed;
  }

  async updateProgress(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const changed = await this.dataSource.transaction(async (manager) => {
      const job = await manager
        .getRepository(AndroidAppLifecycleJob)
        .findOneBy({ applicationId });
      if (!job || job.kind !== kind) {
        return false;
      }

      const app = await this.getApplication(manager, applicationId);
      if (
        app.status === AndroidApplicationStatus.Removing ||
        app.status === AndroidApplicationStatus.Removed ||
        app.status === AndroidApplicationStatus.Stopped
      ) {
        return false;
      }
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
      return true;
    });
    if (changed) {
      await this.logs.appendLifecycle(applicationId, patch);
    }
    return changed;
  }

  async cancelActiveJob(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
      await manager
        .getRepository(AndroidAppLifecycleJob)
        .delete({ applicationId });
    });
    await this.logs.appendLifecycle(applicationId, patch);
  }

  async markState(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
    });
    await this.logs.appendLifecycle(applicationId, patch);
  }

  private async getApplication(manager: EntityManager, applicationId: string) {
    const app = await manager
      .getRepository(AndroidApplication)
      .findOneBy({ id: applicationId });
    if (!app) {
      throw new ConflictException(
        `Android application "${applicationId}" was not found.`,
      );
    }
    return app;
  }

  private applyPatch(
    app: AndroidApplication,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const nextStatus = patch.status;
    if (
      nextStatus &&
      !allowedStatusTransitions[app.status].includes(nextStatus)
    ) {
      throw new ConflictException(
        `Android application cannot transition from ${app.status} to ${nextStatus}.`,
      );
    }
    Object.assign(app, patch);
  }
}
