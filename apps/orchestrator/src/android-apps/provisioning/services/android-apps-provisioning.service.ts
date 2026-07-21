import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
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
import { AndroidAppsApkInstallLifecycleService } from './android-apps-apk-install-lifecycle.service';
import { AndroidAppsRuntimeActivationService } from './android-apps-runtime-activation.service';

@Injectable()
export class AndroidAppsProvisioningService {
  private readonly logger = new Logger(AndroidAppsProvisioningService.name);

  constructor(
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    private readonly activation: AndroidAppsRuntimeActivationService,
    private readonly apkInstall: AndroidAppsApkInstallLifecycleService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly queries: AndroidAppsQueryService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
  ) {}

  async provision(applicationId: string) {
    let app: AndroidApplication | null = null;
    try {
      await this.jobs.markRunning(
        applicationId,
        AndroidAppLifecycleJobKind.Provision,
      );
      app = await this.beginProvisioning(applicationId);
      await this.activation.activate(
        app,
        AndroidAppLifecycleJobKind.Provision,
        'provision',
      );

      if (await this.handoffInitialApk(app)) {
        return;
      }
      await this.finishProvisioning(applicationId);
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(`Provisioning cancelled for ${applicationId}.`);
        await this.removeCancelledProvisioningContainer(app);
        return;
      }

      const message = getErrorMessage(error);
      this.logger.error(`Provisioning failed for ${applicationId}: ${message}`);
      await this.transitions.failJob(
        applicationId,
        AndroidAppLifecycleJobKind.Provision,
        message,
        {
          status: AndroidApplicationStatus.Error,
          lifecycleStage: AndroidApplicationLifecycleStage.Error,
          statusMessage: message,
          lastError: message,
        },
      );
    }
  }

  private async beginProvisioning(applicationId: string) {
    this.tracker.ensureActive(applicationId);
    await this.transitions.updateProgress(
      applicationId,
      AndroidAppLifecycleJobKind.Provision,
      {
        status: AndroidApplicationStatus.Provisioning,
        lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
        statusMessage:
          'Checking whether the container image is available locally.',
        provisioningStartedAt: new Date(),
        lastError: null,
      },
    );

    const app = await this.queries.getStored(applicationId);
    await this.logs.append(applicationId, 'Provisioning started', {
      image: app.containerImage,
      containerName: app.containerName,
      networkName: app.networkName,
      volumeName: app.volumeName,
    });
    this.tracker.ensureActive(applicationId);
    return app;
  }

  private async handoffInitialApk(app: AndroidApplication) {
    await this.logs.append(app.id, 'Initial APK provisioning check', {
      hasApk: Boolean(app.apkFilePath),
      apkOriginalName: app.apkOriginalName,
      apkPackageName: app.apkPackageName,
      uploadedApkId: app.uploadedApkId,
      containerId: app.containerId,
    });
    if (!app.apkFilePath) {
      await this.logs.append(app.id, 'Initial APK provisioning skipped', {
        reason: 'No APK is attached to this app.',
      });
      return false;
    }

    await this.apkInstall.begin(
      app,
      'Installing APK inside Android. Viewer is available while installation finishes.',
      AndroidAppLifecycleJobKind.Provision,
    );
    return true;
  }

  private async finishProvisioning(applicationId: string) {
    this.tracker.ensureActive(applicationId);
    await this.transitions.completeJob(
      applicationId,
      AndroidAppLifecycleJobKind.Provision,
      {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
        provisioningCompletedAt: new Date(),
        lastError: null,
      },
    );
  }

  private async removeCancelledProvisioningContainer(
    app: AndroidApplication | null,
  ) {
    if (!app) {
      return;
    }
    try {
      await this.lifecycle.removeContainerByName(app.containerName);
    } catch (error) {
      this.logger.warn(
        `Could not remove cancelled provisioning container ${app.containerName}: ${getErrorMessage(error)}`,
      );
    }
  }
}
