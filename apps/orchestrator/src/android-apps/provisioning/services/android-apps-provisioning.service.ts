import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_CONTAINER_PROVISIONING,
  type DockerContainerProvisioningPort,
} from '../../../docker/contracts/docker-container-provisioning.port';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../../../docker/contracts/docker-image-runtime.port';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../../../docker/contracts/docker-resource-runtime.port';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidAppsRuntimeNetworkService } from '../../network/services/android-apps-runtime-network.service';
import { AndroidAppsProvisioningAndroidService } from './android-apps-provisioning-android.service';
import { AndroidAppsProvisioningApkService } from './android-apps-provisioning-apk.service';
import { AndroidAppLifecycleJobKind } from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from '../../lifecycle/services/android-app-lifecycle-jobs.service';

@Injectable()
export class AndroidAppsProvisioningService {
  private readonly logger = new Logger(AndroidAppsProvisioningService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    @Inject(DOCKER_CONTAINER_PROVISIONING)
    private readonly provisioningContainers: DockerContainerProvisioningPort,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
    private readonly logs: AndroidAppsLogService,
    private readonly androidProvisioning: AndroidAppsProvisioningAndroidService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly network: AndroidAppsRuntimeNetworkService,
    private readonly queries: AndroidAppsQueryService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly jobs: AndroidAppLifecycleJobsService,
  ) {}

  /** Runs the full setup flow for a new app. */
  async provision(applicationId: string) {
    let app: AndroidApplication | null = null;

    try {
      await this.jobs.markRunning(
        applicationId,
        AndroidAppLifecycleJobKind.Provision,
      );
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
        await this.jobs.complete(
          applicationId,
          AndroidAppLifecycleJobKind.Provision,
        );
        return;
      }

      if (!(error instanceof Error)) {
        this.logger.error(error);
      }
      const message = getErrorMessage(error);
      await this.jobs.markFailed(
        applicationId,
        AndroidAppLifecycleJobKind.Provision,
        message,
      );
      this.logger.error(`Provisioning failed for ${applicationId}: ${message}`);
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

    const app = await this.queries.getStored(applicationId);
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
      void this.writer.setLifecycle(app.id, {
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
    await this.writer.save(app);
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
    await this.network.enforcePolicyAfterStart(app, {
      log: true,
      recordLastStartedAt: true,
      retryAttempts: 10,
    });
    await this.logs.append(app.id, 'Container start requested', {
      containerId: app.containerId,
    });
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
    await this.writer.setLifecycle(app.id, {
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
      const app = await this.queries.getStored(applicationId);
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
      await this.jobs.markFailed(
        applicationId,
        AndroidAppLifecycleJobKind.Provision,
        message,
      );
      this.logger.error(
        `Initial APK install failed for ${applicationId}: ${message}`,
      );
      await this.writer.setLifecycle(applicationId, {
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
    await this.jobs.complete(
      applicationId,
      AndroidAppLifecycleJobKind.Provision,
    );
  }

  /** Writes and saves a lifecycle update. */
  private async setLifecycle(
    applicationId: string,
    patch: Parameters<AndroidAppsStateWriter['setLifecycle']>[1],
  ) {
    await Promise.all([
      this.logs.appendLifecycle(applicationId, patch),
      this.writer.setLifecycle(applicationId, patch),
    ]);
  }
}
