import { Injectable, Logger } from '@nestjs/common';
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
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';
import { AndroidAppsApkInstallLifecycleService } from '../../provisioning/services/android-apps-apk-install-lifecycle.service';
import { AndroidAppsProvisioningApkService } from '../../provisioning/services/android-apps-provisioning-apk.service';
import { AndroidAppsRuntimeActivationService } from '../../provisioning/services/android-apps-runtime-activation.service';

@Injectable()
export class AndroidAppsStartLifecycleService {
  private readonly logger = new Logger(AndroidAppsStartLifecycleService.name);

  constructor(
    private readonly activation: AndroidAppsRuntimeActivationService,
    private readonly apkInstall: AndroidAppsApkInstallLifecycleService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly queries: AndroidAppsQueryService,
  ) {}

  async startInBackground(applicationId: string) {
    try {
      await this.jobs.markRunning(
        applicationId,
        AndroidAppLifecycleJobKind.Start,
      );
      const app = await this.queries.getStored(applicationId);
      this.tracker.ensureActive(app.id);
      await this.logs.append(app.id, 'Container start preparing', {
        profileMode: app.profileMode,
        profileName: app.profileName,
        existingContainerId: app.containerId,
        image: app.containerImage,
      });
      await this.transitions.updateProgress(
        app.id,
        AndroidAppLifecycleJobKind.Start,
        {
          lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
          statusMessage:
            'Checking whether the container image is available locally.',
        },
      );

      await this.activation.activate(
        app,
        AndroidAppLifecycleJobKind.Start,
        'start',
      );
      if (await this.handoffMissingApk(app)) {
        return;
      }

      this.tracker.ensureActive(app.id);
      await this.apkProvisioning.launchInstalledApk(app);
      await this.logs.append(app.id, 'Application marked running', {
        containerId: app.containerId,
      });
      await this.transitions.completeJob(
        app.id,
        AndroidAppLifecycleJobKind.Start,
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
        this.logger.log(`Start cancelled for ${applicationId}.`);
        return;
      }

      const message = getErrorMessage(error);
      this.logger.error(`Start failed for ${applicationId}: ${message}`);
      await this.transitions.failJob(
        applicationId,
        AndroidAppLifecycleJobKind.Start,
        message,
        {
          status: AndroidApplicationStatus.Error,
          lifecycleStage: AndroidApplicationLifecycleStage.Error,
          statusMessage: message,
          lastError: message,
        },
      );
      await this.logs.append(applicationId, 'Start failed', { error: message });
    }
  }

  private async handoffMissingApk(app: AndroidApplication) {
    await this.logs.append(app.id, 'APK startup check', {
      hasApk: Boolean(app.apkFilePath),
      apkOriginalName: app.apkOriginalName,
      apkPackageName: app.apkPackageName,
      uploadedApkId: app.uploadedApkId,
      containerId: app.containerId,
    });
    if (!app.apkFilePath) {
      await this.logs.append(app.id, 'APK startup skipped', {
        reason: 'No APK is attached to this app.',
      });
      return false;
    }
    if (await this.apkProvisioning.isInstalled(app)) {
      await this.logs.append(app.id, 'APK startup install skipped', {
        reason: 'APK package is already installed.',
        apkPackageName: app.apkPackageName,
      });
      return false;
    }

    await this.apkInstall.begin(
      app,
      'Installing APK inside Android before launch. Viewer is available while installation finishes.',
      AndroidAppLifecycleJobKind.Start,
    );
    return true;
  }
}
