import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { RedroidRuntimeConfigService } from '../../../config/redroid-runtime-config.service';
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
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidApplicationLifecycleStage } from '../../contracts/android-application-status';
import { AndroidAppLifecycleJobKind } from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppsRuntimeNetworkService } from '../../network/services/android-apps-runtime-network.service';
import { AndroidAppsProvisioningAndroidService } from './android-apps-provisioning-android.service';

type ActivationSource = 'provision' | 'start';

@Injectable()
export class AndroidAppsRuntimeActivationService {
  private readonly logger = new Logger(
    AndroidAppsRuntimeActivationService.name,
  );

  constructor(
    private readonly redroidConfig: RedroidRuntimeConfigService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    @Inject(DOCKER_CONTAINER_PROVISIONING)
    private readonly containers: DockerContainerProvisioningPort,
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
    private readonly android: AndroidAppsProvisioningAndroidService,
    private readonly network: AndroidAppsRuntimeNetworkService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly writer: AndroidAppsStateWriter,
  ) {}

  async activate(
    app: AndroidApplication,
    kind: AndroidAppLifecycleJobKind,
    source: ActivationSource,
  ) {
    this.logEngineSummary(app.id);
    await this.ensureImageAvailable(app, kind);
    await this.prepareContainer(app, kind, source);
    await this.startContainer(app, kind);
    await this.prepareAndroid(app, kind);
  }

  private logEngineSummary(applicationId: string) {
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
  }

  private async ensureImageAvailable(
    app: AndroidApplication,
    kind: AndroidAppLifecycleJobKind,
  ) {
    if (await this.images.imageExists(app.containerImage)) {
      return;
    }

    this.tracker.ensureActive(app.id);
    await this.transitions.updateProgress(app.id, kind, {
      lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
      statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
    });
    await this.images.pullImage(app.containerImage, (message) => {
      const statusMessage = message || `Pulling ${app.containerImage}.`;
      void this.transitions
        .updateProgress(app.id, kind, { statusMessage })
        .catch((error) => {
          this.logger.warn(
            `Could not persist image pull progress for ${app.id}: ${getErrorMessage(error)}`,
          );
        });
      void this.logs
        .append(app.id, 'Image pull progress', {
          image: app.containerImage,
          message: statusMessage,
        })
        .catch((error) => {
          this.logger.warn(
            `Could not write image pull log for ${app.id}: ${getErrorMessage(error)}`,
          );
        });
    });
    this.tracker.ensureActive(app.id);
  }

  private async prepareContainer(
    app: AndroidApplication,
    kind: AndroidAppLifecycleJobKind,
    source: ActivationSource,
  ) {
    if (app.containerId) {
      await this.transitions.updateProgress(app.id, kind, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Starting application container.',
      });
      await this.network.attachRuntimeSupport(app);
      return;
    }

    await this.transitions.updateProgress(app.id, kind, {
      lifecycleStage: AndroidApplicationLifecycleStage.VolumeCreating,
      statusMessage: 'Preparing application storage and network boundary.',
    });
    await this.network.createRuntimeBoundary(app);
    this.tracker.ensureActive(app.id);
    await this.transitions.updateProgress(app.id, kind, {
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
      statusMessage: `Creating application container ${app.containerName}.`,
    });

    const container = await this.containers.createApplicationContainer({
      applicationId: app.id,
      containerName: app.containerName,
      networkName: app.networkName,
      volumeName: app.volumeName,
      image: app.containerImage,
      dataMountPath: this.redroidConfig.dataMountPath,
      adbPort: app.adbPort,
      privileged: this.redroidConfig.privileged,
      persistentData: app.profileMode === ApplicationProfileMode.Persistent,
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
    await this.writer.setContainerReference(app.id, container.id, false);
    await this.logs.append(
      app.id,
      source === 'provision'
        ? 'Container created'
        : 'Container created for start',
      {
        containerId: container.id,
        containerName: app.containerName,
        image: app.containerImage,
      },
    );
  }

  private async startContainer(
    app: AndroidApplication,
    kind: AndroidAppLifecycleJobKind,
  ) {
    this.tracker.ensureActive(app.id);
    if (!app.containerId) {
      throw new Error('Runtime container was not created.');
    }
    await this.transitions.updateProgress(app.id, kind, {
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting application container.',
    });
    await this.lifecycle.startContainer(app.containerId);
    await this.network.enforcePolicyAfterStart(app, {
      log: kind === AndroidAppLifecycleJobKind.Provision,
      recordLastStartedAt: true,
      retryAttempts: 10,
    });
    await this.logs.append(app.id, 'Container start requested', {
      containerId: app.containerId,
    });
    this.tracker.ensureActive(app.id);
  }

  private async prepareAndroid(
    app: AndroidApplication,
    kind: AndroidAppLifecycleJobKind,
  ) {
    if (!this.android.shouldPrepareRemoteAccess(app)) {
      await this.logs.append(app.id, 'Runtime readiness skipped', {
        image: app.containerImage,
        reason: 'Image is not identified as a Redroid runtime.',
      });
      return;
    }

    await this.transitions.updateProgress(app.id, kind, {
      lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
      statusMessage: 'Waiting for Android to finish booting.',
    });
    await this.android.waitForAndroidBoot(app);
    this.tracker.ensureActive(app.id);
    await this.transitions.updateProgress(app.id, kind, {
      lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
      statusMessage: 'Preparing Android remote access.',
    });
    await this.android.prepareRemoteAccess(app);
  }
}
