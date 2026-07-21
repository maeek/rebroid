import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidAppsApkInstallLifecycleService } from '../../provisioning/services/android-apps-apk-install-lifecycle.service';
import { AndroidAppsProvisioningService } from '../../provisioning/services/android-apps-provisioning.service';
import {
  AndroidAppLifecycleJob,
  AndroidAppLifecycleJobKind,
} from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';
import { AndroidAppsRemovalService } from './android-apps-removal.service';
import { AndroidAppsStartLifecycleService } from './android-apps-start-lifecycle.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';

@Injectable()
export class AndroidAppsLifecycleRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(
    AndroidAppsLifecycleRecoveryService.name,
  );

  constructor(
    private readonly applications: AndroidApplicationsRepository,
    private readonly apkInstall: AndroidAppsApkInstallLifecycleService,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly provisioning: AndroidAppsProvisioningService,
    private readonly removal: AndroidAppsRemovalService,
    private readonly startLifecycle: AndroidAppsStartLifecycleService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
  ) {}

  onModuleInit() {
    void this.recover().catch((error) => {
      this.logger.warn(
        `Could not recover interrupted application jobs: ${getErrorMessage(error)}`,
      );
    });
  }

  async recover() {
    const activeJobs = await this.jobs.listActive();
    const reservedApplicationIds = new Set(
      activeJobs.map((job) => job.applicationId),
    );

    for (const job of activeJobs) {
      const app = await this.applications.findById(job.applicationId);
      if (!app) {
        await this.jobs.removeForApplication(job.applicationId);
        continue;
      }
      if (!this.matchesPersistedState(app, job.kind)) {
        await this.failInconsistentJob(app, job);
        continue;
      }
      this.resume(app, job);
    }

    for (const app of await this.applications.findAll()) {
      if (
        !reservedApplicationIds.has(app.id) &&
        this.requiresLifecycleJob(app)
      ) {
        await this.transitions.markState(app.id, {
          status: AndroidApplicationStatus.Error,
          lifecycleStage: AndroidApplicationLifecycleStage.Error,
          statusMessage:
            'Interrupted lifecycle state has no persisted job and requires a new command.',
          lastError:
            'Lifecycle reservation was missing during startup recovery.',
        });
      }
    }
  }

  private resume(app: AndroidApplication, job: AndroidAppLifecycleJob) {
    this.logger.warn(
      `Resuming persisted ${job.kind} lifecycle job for ${app.id}.`,
    );
    if (job.kind === AndroidAppLifecycleJobKind.Remove) {
      this.tracker.cancel(app.id);
      this.removal.resume(app);
      return;
    }

    this.tracker.reset(app.id);
    if (job.kind === AndroidAppLifecycleJobKind.Provision) {
      this.backgroundJobs.schedule(`provision:${app.id}`, () =>
        this.provisioning.provision(app.id),
      );
      return;
    }
    if (job.kind === AndroidAppLifecycleJobKind.Start) {
      this.backgroundJobs.schedule(`start:${app.id}`, () =>
        this.startLifecycle.startInBackground(app.id),
      );
      return;
    }
    this.apkInstall.resume(app.id);
  }

  private matchesPersistedState(
    app: AndroidApplication,
    kind: AndroidAppLifecycleJobKind,
  ) {
    if (kind === AndroidAppLifecycleJobKind.Remove) {
      return app.status === AndroidApplicationStatus.Removing;
    }
    if (kind === AndroidAppLifecycleJobKind.InstallApk) {
      return (
        app.status === AndroidApplicationStatus.Running &&
        app.lifecycleStage === AndroidApplicationLifecycleStage.ApkInstalling
      );
    }
    return app.status === AndroidApplicationStatus.Provisioning;
  }

  private requiresLifecycleJob(app: AndroidApplication) {
    return (
      app.status === AndroidApplicationStatus.Provisioning ||
      app.status === AndroidApplicationStatus.Removing ||
      (app.status === AndroidApplicationStatus.Running &&
        app.lifecycleStage === AndroidApplicationLifecycleStage.ApkInstalling)
    );
  }

  private async failInconsistentJob(
    app: AndroidApplication,
    job: AndroidAppLifecycleJob,
  ) {
    const message = `Persisted ${job.kind} job does not match application state ${app.status}/${app.lifecycleStage}.`;
    this.logger.warn(`${message} (${app.id})`);
    if (app.status === AndroidApplicationStatus.Removed) {
      await this.jobs.complete(app.id, job.kind);
      return;
    }
    await this.transitions.completeJob(app.id, job.kind, {
      status: AndroidApplicationStatus.Error,
      lifecycleStage: AndroidApplicationLifecycleStage.Error,
      statusMessage: message,
      lastError: message,
    });
  }
}
