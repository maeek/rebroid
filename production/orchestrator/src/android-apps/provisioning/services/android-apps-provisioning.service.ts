import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../../../common/error-message';
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
import { AndroidAppsProvisioningAndroidService } from './android-apps-provisioning-android.service';
import { AndroidAppsProvisioningApkService } from './android-apps-provisioning-apk.service';

@Injectable()
export class AndroidAppsProvisioningService {
  private readonly logger = new Logger(AndroidAppsProvisioningService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly provisioningContainers: DockerContainerProvisioningService,
    private readonly images: DockerImageRuntimeService,
    private readonly resources: DockerResourceRuntimeService,
    private readonly logs: AndroidAppsLogService,
    private readonly androidProvisioning: AndroidAppsProvisioningAndroidService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly network: AndroidAppsRuntimeNetworkService,
    private readonly state: AndroidAppsStateService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
  ) {}

  /** Runs the full setup flow for a new app. */
  async provision(applicationId: string) {
    let app: AndroidApplication | null = null;

    try {
      app = await this.beginProvisioning(applicationId);

      await this.ensureImageAvailable(app);
      await this.prepareRuntimeBoundary(app);
      await this.createManagedContainer(app);
      await this.startManagedContainer(app);
      await this.prepareRuntimeReadiness(app);
      if (!(await this.startInitialApkInstall(app))) {
        await this.finishProvisioning(applicationId);
      }
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(`Provisioning cancelled for ${applicationId}.`);
        await this.removeCancelledProvisioningContainer(app);
        return;
      }

      if (!(error instanceof Error)) {
        this.logger.error(error);
      }
      const message = getErrorMessage(error);
      this.logger.error(`Provisioning failed for ${applicationId}: ${message}`);
      await this.releaseViewerNetworkAfterFailure(applicationId);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Error,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: message,
        lastError: message,
      });
    }
  }

  /** Mops up a container created while a concurrent delete cancelled setup. */
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

  /** Releases viewer-only network attachments after failed provisioning. */
  private async releaseViewerNetworkAfterFailure(applicationId: string) {
    try {
      const app = await this.state.getStored(applicationId);
      if (!app.networkName || app.networkName === 'pending') {
        return;
      }

      await this.network.releaseRuntimeSupport(app);
    } catch (error) {
      this.logger.warn(
        `Could not release viewer network after failed provisioning for ${applicationId}: ${getErrorMessage(error)}`,
      );
    }
  }

  /** Installs the app APK into the running container. */
  async installApk(
    app: AndroidApplication,
    statusMessage = 'Installing APK inside Android.',
  ) {
    return this.apkProvisioning.installApk(app, statusMessage);
  }

  /** Starts the provisioning flow and writes the first logs. */
  private async beginProvisioning(applicationId: string) {
    this.tracker.ensureActive(applicationId);
    await this.setLifecycle(applicationId, {
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
      statusMessage:
        'Checking whether the container image is available locally.',
      provisioningStartedAt: new Date(),
      lastError: null,
    });

    const app = await this.state.getStored(applicationId);
    await this.logs.append(applicationId, 'Provisioning started', {
      image: app.containerImage,
      containerName: app.containerName,
      networkName: app.networkName,
      volumeName: app.volumeName,
    });
    void this.resources
      .engineSummary()
      .then((summary) =>
        this.logs.append(applicationId, 'Container engine selected', summary),
      )
      .catch((error) => {
        this.logger.warn(
          `Could not collect container engine summary for ${applicationId}: ${getErrorMessage(error)}`,
        );
      });
    this.tracker.ensureActive(applicationId);
    return app;
  }

  /** Pulls the container image if it is missing. */
  private async ensureImageAvailable(app: AndroidApplication) {
    if (await this.images.imageExists(app.containerImage)) {
      return;
    }

    this.tracker.ensureActive(app.id);
    await this.setLifecycle(app.id, {
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
            `Could not write image pull log for ${app.id}: ${getErrorMessage(error)}`,
          );
        });
    });
    this.tracker.ensureActive(app.id);
  }

  /** Creates the app network and storage boundary. */
  private async prepareRuntimeBoundary(app: AndroidApplication) {
    this.tracker.ensureActive(app.id);
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.VolumeCreating,
      statusMessage: `Creating persistent data volume ${app.volumeName}.`,
    });
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.NetworkCreating,
      statusMessage: `Creating isolated internal network ${app.networkName}.`,
    });
    await this.setLifecycle(app.id, {
      lifecycleStage:
        AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting,
      statusMessage: 'Connecting orchestrator to the isolated app network.',
    });
    await this.network.createRuntimeBoundary(app);
  }

  /** Creates the managed container record in Docker. */
  private async createManagedContainer(app: AndroidApplication) {
    this.tracker.ensureActive(app.id);
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
      statusMessage: `Creating application container ${app.containerName}.`,
    });
    const container =
      await this.provisioningContainers.createApplicationContainer({
        applicationId: app.id,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
        image: app.containerImage,
        dataMountPath: this.config.getOrThrow<string>(
          'app.redroid.dataMountPath',
        ),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
        profileMode: app.profileMode,
        memoryLimitMb: app.memoryLimitMb,
        cpuLimitCpus: app.cpuLimitCpus,
        containerArgs: app.containerArgs,
        securityOptions: this.config.getOrThrow<string[]>(
          'app.redroid.securityOptions',
        ),
        cgroupnsMode: this.config.get<string>('app.redroid.cgroupnsMode'),
        devices: this.config.getOrThrow<string[]>('app.redroid.devices'),
        optionalDevices: this.config.getOrThrow<string[]>(
          'app.redroid.optionalDevices',
        ),
      });

    this.tracker.ensureActive(app.id);
    app.containerId = container.id;
    await this.state.save(app);
    await this.logs.append(app.id, 'Container created', {
      containerId: container.id,
      containerName: app.containerName,
      image: app.containerImage,
    });
  }

  /** Starts the managed container and applies network rules. */
  private async startManagedContainer(app: AndroidApplication) {
    this.tracker.ensureActive(app.id);
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting application container.',
    });
    await this.lifecycle.startContainer(app.containerId!);
    await Promise.all([
      this.logs.append(app.id, 'Container start requested', {
        containerId: app.containerId,
      }),
      this.network.reconcilePolicy(app, {
        log: true,
        recordLastStartedAt: true,
        failClosed: true,
      }),
    ]);
    this.tracker.ensureActive(app.id);
  }

  /** Waits until Android is ready to use. */
  async prepareRuntimeReadiness(app: AndroidApplication) {
    if (!this.androidProvisioning.shouldPrepareRemoteAccess(app)) {
      await this.logs.append(app.id, 'Runtime readiness skipped', {
        image: app.containerImage,
        reason: 'Image is not identified as a Redroid runtime.',
      });
      return;
    }

    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
      statusMessage: 'Waiting for Android to finish booting.',
    });
    await this.androidProvisioning.waitForAndroidBoot(app);

    this.tracker.ensureActive(app.id);
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
      statusMessage: 'Preparing Android remote access.',
    });
    await this.androidProvisioning.prepareRemoteAccess(app);
  }

  /** Starts the first APK install without blocking viewer availability. */
  private async startInitialApkInstall(app: AndroidApplication) {
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

    this.tracker.ensureActive(app.id);
    const statusMessage =
      'Installing APK inside Android. Viewer is available while installation finishes.';
    await this.logs.appendLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
    });
    await this.state.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
      lastError: null,
    });
    void this.installInitialApkInBackground(app.id, statusMessage);
    return true;
  }

  /** Completes the initial APK install after the runtime is already reachable. */
  private async installInitialApkInBackground(
    applicationId: string,
    statusMessage: string,
  ) {
    try {
      const app = await this.state.getStored(applicationId);
      this.tracker.ensureActive(applicationId);
      await this.apkProvisioning.installApk(app, statusMessage);
      await this.logs.append(
        app.id,
        'Initial APK provisioning install finished',
        {
          apkPackageName: app.apkPackageName,
        },
      );
      this.tracker.ensureActive(applicationId);
      await this.apkProvisioning.launchInstalledApk(app);
      await this.finishProvisioning(applicationId);
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(`Initial APK install cancelled for ${applicationId}.`);
        return;
      }

      const message = getErrorMessage(error);
      this.logger.error(
        `Initial APK install failed for ${applicationId}: ${message}`,
      );
      await this.state.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: `APK install failed: ${message}`,
        lastError: message,
      });
      await this.logs.append(applicationId, 'Initial APK provisioning failed', {
        error: message,
      });
    }
  }

  /** Marks provisioning as finished. */
  private async finishProvisioning(applicationId: string) {
    this.tracker.ensureActive(applicationId);
    await this.setLifecycle(applicationId, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.Ready,
      statusMessage: 'Application is running.',
      provisioningCompletedAt: new Date(),
      lastError: null,
    });
  }

  /** Writes and saves a lifecycle update. */
  private async setLifecycle(
    applicationId: string,
    patch: Parameters<AndroidAppsStateService['setLifecycle']>[1],
  ) {
    await Promise.all([
      this.logs.appendLifecycle(applicationId, patch),
      this.state.setLifecycle(applicationId, patch),
    ]);
  }
}
