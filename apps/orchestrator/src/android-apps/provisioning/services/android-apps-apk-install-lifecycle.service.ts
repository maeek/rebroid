import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppLifecycleJobKind } from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from '../../lifecycle/services/android-app-lifecycle-jobs.service';
import { LifecycleBackgroundJobRunner } from '../../lifecycle/services/lifecycle-background-job-runner.service';
import { AndroidAppsProvisioningApkService } from './android-apps-provisioning-apk.service';

@Injectable()
export class AndroidAppsApkInstallLifecycleService {
  private readonly logger = new Logger(
    AndroidAppsApkInstallLifecycleService.name,
  );

  constructor(
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly queries: AndroidAppsQueryService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
  ) {}

  async begin(
    app: AndroidApplication,
    statusMessage: string,
    currentJobKind?: AndroidAppLifecycleJobKind,
  ) {
    this.tracker.ensureActive(app.id);
    const patch = {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
      lastError: null,
    };
    let started = true;
    if (currentJobKind) {
      started = await this.transitions.handoffJob(
        app.id,
        currentJobKind,
        AndroidAppLifecycleJobKind.InstallApk,
        patch,
      );
    } else {
      await this.transitions.beginJob(
        app.id,
        AndroidAppLifecycleJobKind.InstallApk,
        patch,
      );
    }
    if (!started) {
      throw new ConflictException(
        `Application "${app.id}" no longer owns the expected lifecycle job.`,
      );
    }

    Object.assign(app, patch);
    this.resume(app.id);
  }

  resume(applicationId: string) {
    this.backgroundJobs.schedule(`install-apk:${applicationId}`, () =>
      this.completeInBackground(applicationId),
    );
  }

  private async completeInBackground(applicationId: string) {
    try {
      await this.jobs.markRunning(
        applicationId,
        AndroidAppLifecycleJobKind.InstallApk,
      );
      const app = await this.queries.getStored(applicationId);
      this.tracker.ensureActive(applicationId);
      await this.apkProvisioning.installApk(app);
      await this.logs.append(app.id, 'Background APK install finished', {
        apkPackageName: app.apkPackageName,
      });
      this.tracker.ensureActive(applicationId);
      await this.apkProvisioning.launchInstalledApk(app);
      await this.logs.append(app.id, 'Application marked running', {
        containerId: app.containerId,
      });
      await this.transitions.completeJob(
        applicationId,
        AndroidAppLifecycleJobKind.InstallApk,
        {
          status: AndroidApplicationStatus.Running,
          lifecycleStage: AndroidApplicationLifecycleStage.Ready,
          statusMessage: 'Application is running.',
          lastError: null,
          provisioningCompletedAt: new Date(),
        },
      );
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(
          `Background APK install cancelled for ${applicationId}.`,
        );
        return;
      }

      const message = getErrorMessage(error);
      this.logger.error(
        `Background APK install failed for ${applicationId}: ${message}`,
      );
      await this.transitions.failJob(
        applicationId,
        AndroidAppLifecycleJobKind.InstallApk,
        message,
        {
          status: AndroidApplicationStatus.Running,
          lifecycleStage: AndroidApplicationLifecycleStage.Error,
          statusMessage: `APK install failed: ${message}`,
          lastError: message,
        },
      );
      await this.logs.append(applicationId, 'Background APK install failed', {
        error: message,
      });
    }
  }
}
