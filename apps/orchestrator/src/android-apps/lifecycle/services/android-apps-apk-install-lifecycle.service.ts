import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidAppsProvisioningApkService } from '../../provisioning/services/android-apps-provisioning-apk.service';
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';

@Injectable()
export class AndroidAppsApkInstallLifecycleService {
  private readonly logger = new Logger(
    AndroidAppsApkInstallLifecycleService.name,
  );

  constructor(
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly queries: AndroidAppsQueryService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
  ) {}

  async begin(app: AndroidApplication, statusMessage: string) {
    this.tracker.ensureActive(app.id);
    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.ApkInstalling;
    app.statusMessage = statusMessage;
    app.lastError = null;
    await this.logs.appendLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
    });
    await this.writer.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
      lastError: null,
    });
    await this.jobs.enqueue(app.id, AndroidAppLifecycleJobKind.InstallApk, {
      statusMessage,
    });
    this.resume(app.id, statusMessage);
  }

  resume(applicationId: string, statusMessage: string) {
    this.backgroundJobs.schedule(`install-apk:${applicationId}`, () =>
      this.completeInBackground(applicationId, statusMessage),
    );
  }

  statusMessageFromPayload(payloadJson: string | null) {
    if (!payloadJson) {
      return 'Resuming APK installation after orchestrator restart.';
    }

    try {
      const payload = JSON.parse(payloadJson) as { statusMessage?: unknown };
      return typeof payload.statusMessage === 'string'
        ? payload.statusMessage
        : 'Resuming APK installation after orchestrator restart.';
    } catch {
      return 'Resuming APK installation after orchestrator restart.';
    }
  }

  private async completeInBackground(
    applicationId: string,
    statusMessage: string,
  ) {
    try {
      await this.jobs.markRunning(
        applicationId,
        AndroidAppLifecycleJobKind.InstallApk,
      );
      const app = await this.queries.getStored(applicationId);
      this.tracker.ensureActive(applicationId);
      await this.apkProvisioning.installApk(app, statusMessage);
      await this.logs.append(app.id, 'Background APK install finished', {
        apkPackageName: app.apkPackageName,
      });
      this.tracker.ensureActive(applicationId);
      await this.apkProvisioning.launchInstalledApk(app);
      app.status = AndroidApplicationStatus.Running;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
      app.statusMessage = 'Application is running.';
      app.lastError = null;
      app.provisioningCompletedAt = new Date();
      await this.logs.append(app.id, 'Application marked running', {
        containerId: app.containerId,
      });
      await this.writer.save(app);
      await this.jobs.complete(
        applicationId,
        AndroidAppLifecycleJobKind.InstallApk,
      );
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(
          `Background APK install cancelled for ${applicationId}.`,
        );
        await this.jobs.complete(
          applicationId,
          AndroidAppLifecycleJobKind.InstallApk,
        );
        return;
      }

      const message = getErrorMessage(error);
      await this.jobs.markFailed(
        applicationId,
        AndroidAppLifecycleJobKind.InstallApk,
        message,
      );
      this.logger.error(
        `Background APK install failed for ${applicationId}: ${message}`,
      );
      await this.writer.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: `APK install failed: ${message}`,
        lastError: message,
      });
      await this.logs.append(applicationId, 'Background APK install failed', {
        error: message,
      });
    }
  }
}
