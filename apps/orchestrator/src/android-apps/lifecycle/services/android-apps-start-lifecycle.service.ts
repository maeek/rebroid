import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { RedroidRuntimeConfigService } from '../../../config/redroid-runtime-config.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { DockerContainerProvisioningService } from '../../../docker/containers/services/docker-container-provisioning.service';
import { DockerImageRuntimeService } from '../../../docker/images/services/docker-image-runtime.service';
import { DockerResourceRuntimeService } from '../../../docker/resources/services/docker-resource-runtime.service';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsRuntimeNetworkService } from '../../network/services/android-apps-runtime-network.service';
import { AndroidAppsProvisioningApkService } from '../../provisioning/services/android-apps-provisioning-apk.service';
import { AndroidAppsProvisioningService } from '../../provisioning/services/android-apps-provisioning.service';
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppsApkInstallLifecycleService } from './android-apps-apk-install-lifecycle.service';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';

@Injectable()
export class AndroidAppsStartLifecycleService {
  private readonly logger = new Logger(AndroidAppsStartLifecycleService.name);

  constructor(
    private readonly redroidConfig: RedroidRuntimeConfigService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly provisioningContainers: DockerContainerProvisioningService,
    private readonly images: DockerImageRuntimeService,
    private readonly resources: DockerResourceRuntimeService,
    private readonly provisioning: AndroidAppsProvisioningService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly state: AndroidAppsStateService,
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly apkInstallLifecycle: AndroidAppsApkInstallLifecycleService,
  ) {}

  async startInBackground(id: string) {
    try {
      await this.jobs.markRunning(id, AndroidAppLifecycleJobKind.Start);
      const app = await this.state.getStored(id);
      this.tracker.ensureActive(app.id);

      void this.resources
        .engineSummary()
        .then((summary) =>
          this.logs.append(app.id, 'Container engine selected', summary),
        )
        .catch((error) => {
          this.logger.warn(
            `Could not collect container engine summary for ${app.id}: ${getErrorMessage(error)}`,
          );
        });

      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
        statusMessage:
          'Checking whether the container image is available locally.',
      });
      this.tracker.ensureActive(app.id);

      await this.startPreparedApplication(app);
      await this.jobs.complete(id, AndroidAppLifecycleJobKind.Start);
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(`Start cancelled for ${id}.`);
        await this.jobs.complete(id, AndroidAppLifecycleJobKind.Start);
        return;
      }

      const message = getErrorMessage(error);
      await this.jobs.markFailed(id, AndroidAppLifecycleJobKind.Start, message);
      this.logger.error(`Start failed for ${id}: ${message}`);
      await this.state.setLifecycle(id, {
        status: AndroidApplicationStatus.Error,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: message,
        lastError: message,
      });
      await this.logs.append(id, 'Start failed', { error: message });
    }
  }

  private async startPreparedApplication(app: AndroidApplication) {
    await this.logs.append(app.id, 'Container start preparing', {
      profileMode: app.profileMode,
      profileName: app.profileName,
      existingContainerId: app.containerId,
      image: app.containerImage,
    });

    if (!(await this.images.imageExists(app.containerImage))) {
      this.tracker.ensureActive(app.id);
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
        statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
      });
      await this.images.pullImage(app.containerImage, (message) => {
        void this.state.setLifecycle(app.id, {
          statusMessage: message || `Pulling ${app.containerImage}.`,
        });
        void this.logs
          .append(app.id, 'Image pull progress', {
            image: app.containerImage,
            message: message || `Pulling ${app.containerImage}.`,
          })
          .catch((error) => {
            this.logger.warn(
              `Could not write image pull log for ${app.id}: ${error}`,
            );
          });
      });
    }
    this.tracker.ensureActive(app.id);

    if (!app.containerId) {
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
        statusMessage: `Creating application container ${app.containerName}.`,
      });
      await this.runtimeNetwork.createRuntimeBoundary(app);
      this.tracker.ensureActive(app.id);
      const container =
        await this.provisioningContainers.createApplicationContainer({
          applicationId: app.id,
          containerName: app.containerName,
          networkName: app.networkName,
          volumeName: app.volumeName,
          image: app.containerImage,
          dataMountPath: this.redroidConfig.dataMountPath,
          adbPort: app.adbPort,
          privileged: this.redroidConfig.privileged,
          profileMode: app.profileMode,
          memoryLimitMb: app.memoryLimitMb,
          cpuLimitCpus: app.cpuLimitCpus,
          containerArgs: app.containerArgs,
          securityOptions: this.redroidConfig.securityOptions,
          cgroupnsMode: this.redroidConfig.cgroupnsMode,
          devices: this.redroidConfig.devices,
          optionalDevices: this.redroidConfig.optionalDevices,
        });
      app.containerId = container.id;
      app.recreateContainerOnNextStart = false;
      await this.state.save(app);
      await this.logs.append(app.id, 'Container created for start', {
        containerId: container.id,
        containerName: app.containerName,
        image: app.containerImage,
      });
    } else {
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Starting application container.',
      });
      await this.runtimeNetwork.attachRuntimeSupport(app);
    }
    this.tracker.ensureActive(app.id);

    await this.state.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting application container.',
    });
    await this.lifecycle.startContainer(app.containerId);
    await this.runtimeNetwork.enforcePolicyAfterStart(app, {
      recordLastStartedAt: true,
      retryAttempts: 10,
    });
    await this.logs.append(app.id, 'Container start requested', {
      containerId: app.containerId,
    });
    this.tracker.ensureActive(app.id);
    await this.provisioning.prepareRuntimeReadiness(app);
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
    } else if (await this.apkProvisioning.isInstalled(app)) {
      await this.logs.append(app.id, 'APK startup install skipped', {
        reason: 'APK package is already installed.',
        apkPackageName: app.apkPackageName,
      });
    } else {
      await this.apkInstallLifecycle.begin(
        app,
        'Installing APK inside Android before launch. Viewer is available while installation finishes.',
      );
      return;
    }
    this.tracker.ensureActive(app.id);
    await this.apkProvisioning.launchInstalledApk(app);

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage = 'Application is running.';
    app.lastError = null;
    app.provisioningCompletedAt = new Date();
    await this.logs.append(app.id, 'Application marked running', {
      containerId: app.containerId,
    });
    await this.state.save(app);
  }
}
