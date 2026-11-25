import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { assertOpenDeviceSlot } from './open-device-quota';
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
import {
  isCurrentInactiveRuntime,
  type InactivityCandidate,
} from '../utils/android-apps-inactivity.utils';
import { AndroidAppsLogService } from './android-apps-log.service';
import { AndroidAppRuntimeSnapshotsRepository } from '../../persistence/android-app-runtime-snapshots.repository';
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

export class AndroidAppReservationLostError extends Error {
  constructor() {
    super('Application activation is no longer reserved.');
  }
}

type JobPayload = Record<string, unknown> | undefined;

type RuntimeConfigurationUsed = Pick<
  AndroidApplication,
  'containerArgs' | 'memoryLimitMb' | 'cpuLimitCpus'
>;

type ConfigurationPatch = Partial<
  RuntimeConfigurationUsed &
    Pick<
      AndroidApplication,
      | 'name'
      | 'inactivityTimeoutSeconds'
      | 'uploadedApkId'
      | 'apkFilePath'
      | 'apkOriginalName'
      | 'apkPackageName'
      | 'recreateContainerOnNextStart'
    >
>;

const openStatuses = [
  AndroidApplicationStatus.Provisioning,
  AndroidApplicationStatus.Running,
];

@Injectable()
export class AndroidAppsLifecycleTransitionService {
  private readonly logger = new Logger(
    AndroidAppsLifecycleTransitionService.name,
  );
  constructor(
    private readonly dataSource: DataSource,
    private readonly logs: AndroidAppsLogService,
    private readonly features: FeatureFlagsService,
    private readonly snapshots: AndroidAppRuntimeSnapshotsRepository,
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

  updateConfiguration(
    applicationId: string,
    prepare: (app: AndroidApplication) => ConfigurationPatch,
  ) {
    return this.transaction(async (manager) => {
      const app = await this.getApplication(manager, applicationId);
      if (
        app.status === AndroidApplicationStatus.Removing ||
        app.status === AndroidApplicationStatus.Removed
      ) {
        throw new ConflictException(
          'Applications being removed cannot be updated.',
        );
      }
      this.assertRecreateNotActive(
        await manager
          .getRepository(AndroidAppLifecycleJob)
          .findOneBy({ applicationId }),
      );
      const patch = prepare(app);
      if (!Object.values(patch).some((value) => value !== undefined))
        return app;
      const rows = manager.getRepository(AndroidApplication);
      await rows.update(applicationId, patch);
      return rows.findOneByOrFail({ id: applicationId });
    });
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
    if (kind === AndroidAppLifecycleJobKind.Remove) {
      await this.clearSnapshot(applicationId);
    }
    this.recordLifecycle(applicationId, patch);
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
    if (next) this.recordLifecycle(applicationId, patch);
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
      this.recordLifecycle(applicationId, patch);
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
      this.recordLifecycle(applicationId, patch);
    }
    return changed;
  }

  async advanceJob(
    ...args: Parameters<AndroidAppsLifecycleTransitionService['updateProgress']>
  ) {
    if (!(await this.updateProgress(...args))) {
      throw new AndroidAppReservationLostError();
    }
  }

  async updateProgress(
    reservation: AndroidAppLifecycleReservation,
    patch: AndroidApplicationLifecyclePatch,
    configurationUsed?: RuntimeConfigurationUsed,
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
      if (configurationUsed) {
        app.recreateContainerOnNextStart =
          app.containerArgs !== configurationUsed.containerArgs ||
          app.memoryLimitMb !== configurationUsed.memoryLimitMb ||
          app.cpuLimitCpus !== configurationUsed.cpuLimitCpus;
      }
      await manager.getRepository(AndroidApplication).save(app);
      return true;
    });
    if (changed) {
      this.recordLifecycle(applicationId, patch);
    }
    return changed;
  }

  async admitInactiveStop(expected: InactivityCandidate) {
    const patch = {
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
      statusMessage: 'Stopping application container.',
    };
    const admitted = await this.transaction(async (manager) => {
      const applications = manager.getRepository(AndroidApplication);
      const app = await applications.findOneBy({ id: expected.id });
      if (
        !app?.containerId ||
        !isCurrentInactiveRuntime(app, expected, new Date()) ||
        (await manager
          .getRepository(AndroidAppLifecycleJob)
          .existsBy({ applicationId: expected.id }))
      ) {
        return null;
      }

      await applications.update(app.id, patch);
      return Object.assign(app, patch);
    });
    if (admitted) {
      await this.clearSnapshot(admitted.id);
      this.recordLifecycle(admitted.id, patch);
    }
    return admitted;
  }

  async cancelActiveJob(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    const leftRunning = await this.transaction(async (manager) => {
      const jobs = manager.getRepository(AndroidAppLifecycleJob);
      this.assertRecreateNotActive(await jobs.findOneBy({ applicationId }));
      const app = await this.getApplication(manager, applicationId);
      const wasRunning = app.status === AndroidApplicationStatus.Running;
      this.applyPatch(app, patch);
      await manager.getRepository(AndroidApplication).save(app);
      await jobs.delete({ applicationId });
      return wasRunning && app.status !== AndroidApplicationStatus.Running;
    });
    if (leftRunning) await this.clearSnapshot(applicationId);
    this.recordLifecycle(applicationId, patch);
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
    this.recordLifecycle(applicationId, patch);
  }

  private recordLifecycle(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    void Promise.resolve()
      .then(() => this.logs.appendLifecycle(applicationId, patch))
      .catch(() =>
        this.logger.warn(
          `Could not record lifecycle transition for ${applicationId}.`,
        ),
      );
  }

  private async clearSnapshot(applicationId: string) {
    try {
      await this.snapshots.deleteIfStale(applicationId);
    } catch {
      this.logger.warn(
        `Could not clear runtime snapshot for ${applicationId}.`,
      );
    }
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

    await assertOpenDeviceSlot(manager, ownerUserId, maxOpenApps);
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
