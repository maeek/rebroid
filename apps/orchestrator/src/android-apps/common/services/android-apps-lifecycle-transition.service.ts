import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { ConflictException, Injectable } from '@nestjs/common';
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
  type AndroidAppLifecycleReservation,
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
  constructor(
    private readonly dataSource: DataSource,
    private readonly logs: AndroidAppsLogService,
    private readonly features: FeatureFlagsService,
  ) {}

  hasRecreateJob(applicationId: string) {
    return this.dataSource.getRepository(AndroidAppLifecycleJob).existsBy({
      applicationId,
      kind: AndroidAppLifecycleJobKind.Recreate,
    });
  }

  async assertNoRecreation(applicationId: string) {
    if (await this.hasRecreateJob(applicationId)) {
      throw new ConflictException('Application runtime is being recreated.');
    }
  }

  async createProvisionJob(app: AndroidApplication, maxOpenApps?: number) {
    return this.transaction(async (manager) => {
      await this.assertOpenAppSlot(manager, app.ownerUserId, maxOpenApps);
      await manager.getRepository(AndroidApplication).save(app);
      const jobs = manager.getRepository(AndroidAppLifecycleJob);
      return jobs.save(
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
    const reservation = await this.transaction(async (manager) => {
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

      if (existing) await repository.remove(existing);
      await manager.getRepository(AndroidApplication).save(app);
      return repository.save(
        repository.create({
          applicationId,
          kind,
          status: AndroidAppLifecycleJobStatus.Pending,
          attempts: 0,
          payloadJson: payload ? JSON.stringify(payload) : null,
        }),
      );
    });
    await this.logs.appendLifecycle(applicationId, patch);
    return reservation;
  }

  async handoffJob(
    reservation: AndroidAppLifecycleReservation,
    nextKind: AndroidAppLifecycleJobKind,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const { applicationId } = reservation;
    const next = await this.transaction(async (manager) => {
      const jobs = manager.getRepository(AndroidAppLifecycleJob);
      const current = await jobs.findOneBy({
        ...reservationKey(reservation),
        status: AndroidAppLifecycleJobStatus.Running,
      });
      if (!current) return null;

      const app = await this.getApplication(manager, applicationId);
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
      await jobs.remove(current);
      return jobs.save(
        jobs.create({
          applicationId,
          kind: nextKind,
          status: AndroidAppLifecycleJobStatus.Pending,
          attempts: 0,
        }),
      );
    });
    if (next) await this.logs.appendLifecycle(applicationId, patch);
    return next;
  }

  async claimJob(reservation: AndroidAppLifecycleReservation) {
    const claimed = await this.dataSource
      .getRepository(AndroidAppLifecycleJob)
      .update(
        {
          ...reservationKey(reservation),
          status: AndroidAppLifecycleJobStatus.Pending,
          lastError: IsNull(),
        },
        {
          status: AndroidAppLifecycleJobStatus.Running,
          attempts: () => 'attempts + 1',
        },
      );
    return claimed.affected === 1;
  }

  listJobs() {
    return this.dataSource
      .getRepository(AndroidAppLifecycleJob)
      .find({ order: { updatedAt: 'ASC' } });
  }

  async requeueInterruptedJob(job: AndroidAppLifecycleJob) {
    const result = await this.dataSource
      .getRepository(AndroidAppLifecycleJob)
      .update(
        { ...reservationKey(job), status: job.status },
        { status: AndroidAppLifecycleJobStatus.Pending, lastError: null },
      );
    return result.affected === 1;
  }

  discardJob(reservation: AndroidAppLifecycleReservation) {
    return this.dataSource
      .getRepository(AndroidAppLifecycleJob)
      .delete(reservationKey(reservation));
  }

  async completeRemoval(reservation: AndroidAppLifecycleReservation) {
    return this.transaction(async (manager) => {
      const result = await manager
        .getRepository(AndroidAppLifecycleJob)
        .delete({
          ...reservationKey(reservation),
          kind: AndroidAppLifecycleJobKind.Remove,
          status: AndroidAppLifecycleJobStatus.Running,
        });
      if (result.affected !== 1) return false;
      await manager
        .getRepository(AndroidApplication)
        .delete(reservation.applicationId);
      return true;
    });
  }

  async completeJob(
    reservation: AndroidAppLifecycleReservation,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const { applicationId } = reservation;
    const changed = await this.transaction(async (manager) => {
      const repository = manager.getRepository(AndroidAppLifecycleJob);
      const job = await repository.findOneBy(reservationKey(reservation));
      if (!job) {
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
    reservation: AndroidAppLifecycleReservation,
    error: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const { applicationId } = reservation;
    const changed = await this.transaction(async (manager) => {
      const repository = manager.getRepository(AndroidAppLifecycleJob);
      const job = await repository.findOneBy({
        ...reservationKey(reservation),
        status: AndroidAppLifecycleJobStatus.Running,
      });
      if (!job) {
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
    reservation: AndroidAppLifecycleReservation,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const { applicationId } = reservation;
    const changed = await this.transaction(async (manager) => {
      const job = await manager
        .getRepository(AndroidAppLifecycleJob)
        .findOneBy({
          ...reservationKey(reservation),
          status: AndroidAppLifecycleJobStatus.Running,
        });
      if (!job) {
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
    return this.dataSource.transaction(operation);
  }

  private async assertOpenAppSlot(
    manager: EntityManager,
    ownerUserId: string | null,
    maxOpenApps?: number,
  ) {
    if (
      maxOpenApps === undefined ||
      !this.features.isEnabled('feature.resource-quota')
    )
      return;

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

const reservationKey = ({
  id,
  applicationId,
  kind,
}: AndroidAppLifecycleReservation) => ({ id, applicationId, kind });
