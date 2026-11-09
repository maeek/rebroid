import { ConflictException, Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import { DataSource, In, IsNull, type EntityManager } from 'typeorm';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
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

const openStatuses = [
  AndroidApplicationStatus.Provisioning,
  AndroidApplicationStatus.Running,
];

@Injectable()
export class AndroidAppsLifecycleTransitionService {
  private readonly serializeTransition = pLimit(1);

  constructor(
    private readonly dataSource: DataSource,
    private readonly logs: AndroidAppsLogService,
  ) {}

  hasRecreateJob(applicationId: string) {
    return this.dataSource.getRepository(AndroidAppLifecycleJob).existsBy({
      applicationId,
      kind: AndroidAppLifecycleJobKind.Recreate,
    });
  }

  async createProvisionJob(app: AndroidApplication, maxOpenApps?: number) {
    await this.transaction(async (manager) => {
      await this.assertOpenAppSlot(manager, app.ownerUserId, maxOpenApps);
      await manager.getRepository(AndroidApplication).save(app);
      const jobs = manager.getRepository(AndroidAppLifecycleJob);
      await jobs.save(
        jobs.create({
          applicationId: app.id,
          kind: AndroidAppLifecycleJobKind.Provision,
          status: AndroidAppLifecycleJobStatus.Pending,
          attempts: 0,
        }),
      );
    });
  }

  async beginJob(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
    patch: AndroidApplicationLifecyclePatch,
    payload?: JobPayload,
    replaceExisting = false,
    maxOpenApps?: number,
  ) {
    await this.transaction(async (manager) => {
      const app = await this.getApplication(manager, applicationId);

      const repository = manager.getRepository(AndroidAppLifecycleJob);
      const existing = await repository.findOneBy({ applicationId });
      this.assertRecreateNotActive(existing);
      if (
        kind === AndroidAppLifecycleJobKind.Recreate &&
        ((app.status !== AndroidApplicationStatus.Stopped &&
          app.status !== AndroidApplicationStatus.Error) ||
          app.lifecycleStage === AndroidApplicationLifecycleStage.Stopping ||
          (existing && !existing.lastError))
      ) {
        throw new ConflictException(
          'Stop the app and wait for any lifecycle operation to finish before recreating it.',
        );
      }
      if (existing && existing.kind !== kind && !replaceExisting) {
        throw new ConflictException(
          `Application "${applicationId}" is reserved by a ${existing.kind} lifecycle job.`,
        );
      }
      if (
        patch.status === AndroidApplicationStatus.Provisioning &&
        !openStatuses.includes(app.status)
      ) {
        await this.assertOpenAppSlot(manager, app.ownerUserId, maxOpenApps);
      }
      this.applyPatch(app, patch);

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
    const changed = await this.transaction(async (manager) => {
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
    const changed = await this.transaction(async (manager) => {
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
    const changed = await this.transaction(async (manager) => {
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
    const changed = await this.transaction(async (manager) => {
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
    await this.transaction(async (manager) => {
      const jobs = manager.getRepository(AndroidAppLifecycleJob);
      this.assertRecreateNotActive(await jobs.findOneBy({ applicationId }));
      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
      await jobs.delete({ applicationId });
    });
    await this.logs.appendLifecycle(applicationId, patch);
  }

  private assertRecreateNotActive(job: AndroidAppLifecycleJob | null) {
    if (job?.kind === AndroidAppLifecycleJobKind.Recreate) {
      throw new ConflictException('Application runtime is being recreated.');
    }
  }

  async markState(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    await this.transaction(async (manager) => {
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

  private transaction<T>(operation: (manager: EntityManager) => Promise<T>) {
    return this.serializeTransition(() =>
      this.dataSource.transaction(operation),
    );
  }

  private async assertOpenAppSlot(
    manager: EntityManager,
    ownerUserId: string | null,
    maxOpenApps?: number,
  ) {
    if (maxOpenApps === undefined) return;

    const openApps = await manager.getRepository(AndroidApplication).countBy([
      { ownerUserId: ownerUserId ?? IsNull(), status: In(openStatuses) },
      {
        ownerUserId: ownerUserId ?? IsNull(),
        lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
      },
    ]);
    if (openApps >= maxOpenApps) {
      throw new ConflictException({
        statusCode: 409,
        code: 'open_app_quota_exceeded',
        message: `Open app limit reached (${openApps}/${maxOpenApps}). Stop an app before starting another.`,
      });
    }
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
