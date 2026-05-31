import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadedApk } from '../../../apk/entities/uploaded-apk.entity';
import { ApkCatalogService } from '../../../apk/services/apk-catalog.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { DockerContainerProvisioningService } from '../../../docker/containers/services/docker-container-provisioning.service';
import { DockerImageRuntimeService } from '../../../docker/images/services/docker-image-runtime.service';
import { DockerNetworkRuntimeService } from '../../../docker/networks/services/docker-network-runtime.service';
import { DockerResourceRuntimeService } from '../../../docker/resources/services/docker-resource-runtime.service';
import { getErrorMessage } from '../../../common/error-message';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { SettingsService } from '../../../settings/settings.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { CloneAndroidApplicationDto } from '../../common/dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { RemoveAndroidApplicationDto } from '../../common/dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../../common/dto/update-android-application.dto';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { resolveContainerImage } from '../../common/utils/android-apps-container-image.utils';
import {
  parseSavedProfiles,
  rememberSavedProfile,
} from '../../common/utils/android-apps-profile-history.utils';
import { stoppedStatusMessage } from '../../common/utils/android-apps-status-message.utils';
import { AndroidAppsRuntimeNetworkService } from '../../network/services/android-apps-runtime-network.service';
import { AndroidAppsProvisioningApkService } from '../../provisioning/services/android-apps-provisioning-apk.service';
import { AndroidAppsProvisioningService } from '../../provisioning/services/android-apps-provisioning.service';
import {
  applyRedroidDefaultContainerArgs,
  isRedroidImageName,
} from '../../provisioning/utils/redroid-runtime.utils';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';

@Injectable()
export class AndroidAppsLifecycleService {
  private readonly logger = new Logger(AndroidAppsLifecycleService.name);

  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly provisioningContainers: DockerContainerProvisioningService,
    private readonly images: DockerImageRuntimeService,
    private readonly networks: DockerNetworkRuntimeService,
    private readonly resources: DockerResourceRuntimeService,
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly settings: SettingsService,
    private readonly apks: ApkCatalogService,
    private readonly provisioning: AndroidAppsProvisioningService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly state: AndroidAppsStateService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
  ) {}

  /** Creates a new app and starts provisioning. */
  async create(dto: CreateAndroidApplicationDto) {
    const [settings, uploadedApk] = await Promise.all([
      this.settings.getSettings(),
      dto.uploadedApkId
        ? this.apks.get(dto.uploadedApkId)
        : Promise.resolve(null),
    ]);

    const containerImage = resolveContainerImage(
      dto.containerImage ?? settings.defaultContainerImage,
      settings.dockerImageRegistry,
    );

    const app = this.applications.create({
      name: dto.name,
      ownerUserId: dto.ownerUserId ?? null,
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.Queued,
      statusMessage: 'Provisioning has been queued.',
      containerImage,
      containerName: 'pending',
      networkName: 'pending',
      volumeName: 'pending',
      containerId: null,
      apkFilePath: null,
      apkOriginalName: null,
      apkPackageName: null,
      uploadedApkId: null,
      scrcpyTransport: settings.defaultScrcpyTransport,
      adbPort: this.config.getOrThrow<number>('app.redroid.adbPort'),
      inactivityTimeoutSeconds:
        dto.inactivityTimeoutSeconds ??
        settings.defaultInactivityTimeoutSeconds,
      profileMode: ApplicationProfileMode.Persistent,
      profileName: 'default',
      savedProfilesJson: rememberSavedProfile(null, {
        mode: ApplicationProfileMode.Persistent,
        name: 'default',
      }),
      memoryLimitMb: dto.memoryLimitMb ?? null,
      cpuLimitCpus: dto.cpuLimitCpus ?? null,
      volumeSizeLimitMb: dto.volumeSizeLimitMb ?? null,
      containerArgs: applyRedroidDefaultContainerArgs(
        containerImage,
        dto.containerArgs,
      ),
      recreateContainerOnNextStart: false,
      networkPolicyEnabled: true,
      networkPolicyAllowCidrs: '[]',
      networkPolicyStatus: null,
      networkPolicyMessage: null,
      networkPolicyAppliedAt: null,
      lastScrcpyActivityAt: null,
      lastStartedAt: null,
      lastStoppedAt: null,
      provisioningStartedAt: null,
      provisioningCompletedAt: null,
      lastError: null,
    });

    await this.state.save(app);

    const names = this.networkIsolation.namesFor(
      app.id,
      app.name,
      app.profileName,
    );
    Object.assign(app, names);

    if (uploadedApk) {
      this.applyUploadedApk(app, uploadedApk);
    }

    await this.state.save(app);
    await this.logs.append(app.id, 'Application record created', {
      name: app.name,
      ownerUserId: app.ownerUserId,
      image: app.containerImage,
      hasApk: Boolean(uploadedApk),
    });
    this.tracker.reset(app.id);

    void this.provisioning.provision(app.id);

    return this.state.decorateApplication(app);
  }

  /** Makes a new app from an existing one. */
  async clone(id: string, dto: CloneAndroidApplicationDto) {
    const source = await this.state.get(id);
    const ownerUserId = dto.ownerUserId?.trim() || null;
    const uploadedApk = source.uploadedApkId
      ? await this.apks.cloneForOwner(source.uploadedApkId, ownerUserId)
      : null;

    return this.create({
      name: dto.name?.trim() || source.name,
      ownerUserId: ownerUserId ?? undefined,
      containerImage: source.containerImage,
      inactivityTimeoutSeconds: source.inactivityTimeoutSeconds,
      memoryLimitMb: source.memoryLimitMb ?? undefined,
      cpuLimitCpus: source.cpuLimitCpus ?? undefined,
      volumeSizeLimitMb: source.volumeSizeLimitMb ?? undefined,
      containerArgs: source.containerArgs ?? undefined,
      uploadedApkId: uploadedApk?.id,
    });
  }

  /** Updates the editable app settings. */
  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.state.get(id);
    const shouldRecreateContainer = this.shouldRecreateContainerOnUpdate(
      app,
      dto,
    );

    if (dto.name !== undefined) {
      app.name = dto.name;
    }
    if (dto.inactivityTimeoutSeconds !== undefined) {
      app.inactivityTimeoutSeconds = dto.inactivityTimeoutSeconds;
    }
    if (dto.memoryLimitMb !== undefined) {
      app.memoryLimitMb = dto.memoryLimitMb;
    }
    if (dto.cpuLimitCpus !== undefined) {
      app.cpuLimitCpus = dto.cpuLimitCpus;
    }
    if (dto.volumeSizeLimitMb !== undefined) {
      app.volumeSizeLimitMb = dto.volumeSizeLimitMb;
    }
    if (dto.containerArgs !== undefined) {
      app.containerArgs = applyRedroidDefaultContainerArgs(
        app.containerImage,
        dto.containerArgs,
      );
    }

    if (shouldRecreateContainer) {
      await this.markContainerForRecreation(app);
    }

    return this.state.saveAndDecorate(app);
  }

  /** Switches the app to another profile. */
  async switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    if (app.containerId) {
      await this.networkPolicy.remove(app);
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }

    app.profileMode = dto.profileMode ?? app.profileMode;
    app.profileName = dto.profileName?.trim() || app.profileName || 'default';
    app.volumeName = this.networkIsolation.namesFor(
      app.id,
      app.name,
      app.profileName,
    ).volumeName;
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage =
      'Profile switched. Start the app to create a container for this profile.';
    app.lastStoppedAt = new Date();

    return this.state.saveAndDecorate(app);
  }

  /** Starts an app container. */
  async start(id: string, dto: StartAndroidApplicationDto = {}) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    if (app.status === AndroidApplicationStatus.Provisioning) {
      if (!(await this.recoverStaleProvisioningForStart(app))) {
        return this.state.decorateApplication(app);
      }
    }

    if (app.status === AndroidApplicationStatus.Running) {
      if (app.apkFilePath) {
        await this.apkProvisioning.launchInstalledApk(app);
      }

      return this.state.decorateApplication(app);
    }

    if (app.status === AndroidApplicationStatus.Removing) {
      throw new ConflictException(
        'Application is being removed and cannot be started.',
      );
    }

    if (dto.profileMode !== undefined || dto.profileName !== undefined) {
      await this.prepareRuntimeProfile(app, dto);
    }

    await this.prepareRuntimeDefaults(app);
    await this.state.clearMissingContainerReference(app);
    await this.prepareFailedContainerForRestart(app);
    await this.prepareContainerForRuntimeHostConfig(app);
    await this.prepareContainerForRecreationOnStart(app);

    this.tracker.reset(app.id);
    app.status = AndroidApplicationStatus.Provisioning;
    app.lifecycleStage = AndroidApplicationLifecycleStage.ContainerStarting;
    app.statusMessage = 'Starting application container.';
    app.lastError = null;
    app.provisioningStartedAt = new Date();
    app.provisioningCompletedAt = null;
    await this.state.save(app);
    await this.logs.append(app.id, 'Start requested', {
      profileMode: app.profileMode,
      profileName: app.profileName,
      existingContainerId: app.containerId,
      image: app.containerImage,
    });

    void this.startInBackground(app.id);

    return this.state.decorateApplication(app);
  }

  /** Runs the long start flow outside the HTTP request. */
  private async startInBackground(id: string) {
    try {
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
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(`Start cancelled for ${id}.`);
        return;
      }

      const message = getErrorMessage(error);
      this.logger.error(`Start failed for ${id}: ${message}`);
      await this.releaseRuntimeSupportAfterFailedStart(id);
      await this.state.setLifecycle(id, {
        status: AndroidApplicationStatus.Error,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: message,
        lastError: message,
      });
      await this.logs.append(id, 'Start failed', { error: message });
    }
  }

  /** Releases viewer/runtime support after a failed asynchronous start. */
  private async releaseRuntimeSupportAfterFailedStart(id: string) {
    try {
      const app = await this.state.getStored(id);
      if (!app.networkName || app.networkName === 'pending') {
        return;
      }

      await this.runtimeNetwork.releaseRuntimeSupport(app);
    } catch (error) {
      this.logger.warn(
        `Could not release runtime support after failed start for ${id}: ${getErrorMessage(error)}`,
      );
    }
  }

  /** Continues a start request after the response has been returned. */
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
    await Promise.all([
      this.logs.append(app.id, 'Container start requested', {
        containerId: app.containerId,
      }),
      this.runtimeNetwork.reconcilePolicy(app, {
        recordLastStartedAt: true,
        failClosed: true,
      }),
    ]);
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
      await this.startApkInstallInBackground(
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

  /** Keeps the viewer available while a missing APK is installed after startup. */
  private async startApkInstallInBackground(
    app: AndroidApplication,
    statusMessage: string,
  ) {
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
    await this.state.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
      lastError: null,
    });
    void this.completeApkInstallInBackground(app.id, statusMessage);
  }

  /** Finishes an APK install after the runtime has been exposed. */
  private async completeApkInstallInBackground(
    applicationId: string,
    statusMessage: string,
  ) {
    try {
      const app = await this.state.getStored(applicationId);
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
      await this.state.save(app);
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
      await this.state.setLifecycle(applicationId, {
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

  /** Stops an app container. */
  async stop(id: string) {
    const app = await this.state.get(id);
    this.tracker.cancel(id);

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopping;
    app.statusMessage = 'Stopping application container.';
    await this.state.save(app);
    await this.logs.append(app.id, 'Stop requested', {
      containerId: app.containerId,
    });

    if (app.containerId) {
      await this.lifecycle.stopContainer(app.containerId);
    }

    await this.displaySidecar
      .releaseSessionsForApp(app.id)
      .catch(() => undefined);
    await this.runtimeNetwork.releaseRuntimeSupport(app);

    if (app.recreateContainerOnNextStart && app.containerId) {
      await this.removeManagedContainer(app);
      app.recreateContainerOnNextStart = false;
    }

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = stoppedStatusMessage(app);
    app.lastStoppedAt = new Date();
    await this.logs.append(app.id, 'Application stopped', {
      containerId: app.containerId,
      recreateContainerOnNextStart: app.recreateContainerOnNextStart,
    });
    return this.state.saveAndDecorate(app);
  }

  /** Replaces the APK and installs it if the app is running. */
  async updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    const uploadedApk = await this.apks.get(dto.uploadedApkId);
    this.applyUploadedApk(app, uploadedApk);
    await this.state.save(app);

    if (app.status === AndroidApplicationStatus.Running) {
      await this.startApkInstallInBackground(
        app,
        'Installing updated APK. Viewer is available while installation finishes.',
      );
      return this.state.get(id);
    }

    return this.state.saveAndDecorate(app);
  }

  /** Removes the app and its Docker resources. */
  async remove(id: string, query: RemoveAndroidApplicationDto) {
    const app = await this.state.get(id);
    this.tracker.cancel(id);
    app.status = AndroidApplicationStatus.Removing;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Removing;
    app.statusMessage = 'Removing application container and network resources.';
    await this.state.save(app);
    await this.logs.append(app.id, 'Remove requested', {
      removeData: query.removeData ?? true,
      containerId: app.containerId,
      networkName: app.networkName,
      volumeName: app.volumeName,
    });

    if (app.containerId) {
      await this.networkPolicy.remove(app);
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }
    await this.lifecycle.removeContainerByName(app.containerName);
    await this.displaySidecar
      .releaseSessionsForApp(app.id)
      .catch(() => undefined);

    await this.networks.removeNetwork(app.networkName);
    const removeData = query.removeData ?? true;
    if (removeData) {
      const volumeNames = new Set([
        app.volumeName,
        ...parseSavedProfiles(app.savedProfilesJson).map(
          (profile) =>
            this.networkIsolation.namesFor(app.id, app.name, profile.name)
              .volumeName,
        ),
      ]);
      await Promise.all(
        [...volumeNames].map((volumeName) =>
          this.resources.removeVolume(volumeName),
        ),
      );
    }

    await this.applications.remove(app);
    await this.logs.remove(id);

    return {
      id,
      deleted: true,
      removedData: removeData,
    };
  }

  /** Applies profile changes before starting the app. */
  private async prepareRuntimeProfile(
    app: AndroidApplication,
    dto: StartAndroidApplicationDto,
  ) {
    const nextProfileMode = dto.profileMode ?? app.profileMode;
    const nextProfileName =
      dto.profileName?.trim() || app.profileName || 'default';
    const nextVolumeName = this.networkIsolation.namesFor(
      app.id,
      app.name,
      nextProfileName,
    ).volumeName;
    const profileChanged =
      nextProfileMode !== app.profileMode ||
      nextProfileName !== app.profileName ||
      nextVolumeName !== app.volumeName;
    const nextSavedProfilesJson = rememberSavedProfile(app.savedProfilesJson, {
      mode: nextProfileMode,
      name: nextProfileName,
    });

    if (!profileChanged) {
      if (nextSavedProfilesJson !== app.savedProfilesJson) {
        app.savedProfilesJson = nextSavedProfilesJson;
        await this.state.save(app);
      }
      return;
    }

    if (app.containerId) {
      await this.networkPolicy.remove(app);
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }

    app.profileMode = nextProfileMode;
    app.profileName = nextProfileName;
    app.savedProfilesJson = nextSavedProfilesJson;
    app.volumeName = nextVolumeName;
    await this.state.save(app);
  }

  /** Checks if an update needs a fresh container. */
  private shouldRecreateContainerOnUpdate(
    app: AndroidApplication,
    dto: UpdateAndroidApplicationDto,
  ) {
    return (
      (dto.memoryLimitMb !== undefined &&
        dto.memoryLimitMb !== app.memoryLimitMb) ||
      (dto.cpuLimitCpus !== undefined &&
        dto.cpuLimitCpus !== app.cpuLimitCpus) ||
      (dto.containerArgs !== undefined &&
        (dto.containerArgs?.trim() || null) !== app.containerArgs)
    );
  }

  /** Marks the current container to be recreated later. */
  private async markContainerForRecreation(app: AndroidApplication) {
    if (!app.containerId) {
      app.recreateContainerOnNextStart = false;
      return;
    }

    if (app.status === AndroidApplicationStatus.Running) {
      app.recreateContainerOnNextStart = true;
      app.statusMessage =
        'Runtime settings changed. Stop and start the app to recreate the managed container.';
      return;
    }

    await this.removeManagedContainer(app);
    app.recreateContainerOnNextStart = false;
    app.statusMessage =
      'Runtime settings changed. A new container will be created on next start.';
  }

  /** Recreates the container on start when needed. */
  private async prepareContainerForRecreationOnStart(app: AndroidApplication) {
    if (!app.recreateContainerOnNextStart) {
      return;
    }

    if (!app.containerId) {
      app.recreateContainerOnNextStart = false;
      await this.state.save(app);
      return;
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.running) {
      throw new ConflictException(
        'Runtime settings changed. Stop the app before starting it again so the managed container can be recreated.',
      );
    }

    await this.removeManagedContainer(app);
    app.recreateContainerOnNextStart = false;
    await this.state.save(app);
  }

  /** Recreates stopped containers when Docker-only host config defaults changed. */
  private async prepareContainerForRuntimeHostConfig(app: AndroidApplication) {
    if (!app.containerId || !isRedroidImageName(app.containerImage)) {
      return;
    }

    const desiredCgroupnsMode = this.normalizedHostConfigValue(
      this.config.get<string>('app.redroid.cgroupnsMode'),
    );
    const desiredDevices = this.normalizedDeviceMappings(
      this.config.getOrThrow<string[]>('app.redroid.devices'),
    );
    if (!desiredCgroupnsMode && desiredDevices.length === 0) {
      return;
    }

    const inspect = await this.lifecycle.inspectContainer(app.containerId);
    const hostConfig = inspect.HostConfig as
      | (Record<string, unknown> & { CgroupnsMode?: unknown })
      | undefined;
    const currentCgroupnsMode =
      typeof hostConfig?.CgroupnsMode === 'string'
        ? this.normalizedHostConfigValue(hostConfig.CgroupnsMode)
        : null;
    const currentDevices = Array.isArray(hostConfig?.Devices)
      ? hostConfig.Devices.filter(
          (
            device,
          ): device is {
            PathOnHost?: unknown;
            PathInContainer?: unknown;
            CgroupPermissions?: unknown;
          } => Boolean(device) && typeof device === 'object',
        )
          .map((device) =>
            [
              typeof device.PathOnHost === 'string' ? device.PathOnHost : '',
              typeof device.PathInContainer === 'string'
                ? device.PathInContainer
                : '',
              typeof device.CgroupPermissions === 'string'
                ? device.CgroupPermissions
                : '',
            ].join(':'),
          )
          .sort()
      : [];

    if (
      currentCgroupnsMode === desiredCgroupnsMode &&
      this.sameStringArray(currentDevices, desiredDevices)
    ) {
      return;
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.running) {
      app.recreateContainerOnNextStart = true;
      app.statusMessage =
        'Runtime host configuration changed. Stop and start the app to recreate the managed container.';
      await this.state.save(app);
      return;
    }

    await this.logs.append(
      app.id,
      'Recreating container for runtime host config',
      {
        containerId: app.containerId,
        containerName: app.containerName,
        currentCgroupnsMode,
        desiredCgroupnsMode,
        currentDevices,
        desiredDevices,
      },
    );
    await this.removeManagedContainer(app);
    app.recreateContainerOnNextStart = false;
    app.statusMessage =
      'Runtime host configuration changed. A new container will be created on next start.';
    await this.state.save(app);
  }

  private normalizedHostConfigValue(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private normalizedDeviceMappings(devices: string[]) {
    return devices
      .map((device) => device.trim())
      .filter(Boolean)
      .map((device) => {
        const [hostPath, containerPath = hostPath, permissions = 'rwm'] = device
          .split(':')
          .map((part) => part.trim());
        return [hostPath, containerPath, permissions || 'rwm'].join(':');
      })
      .sort();
  }

  private sameStringArray(left: string[], right: string[]) {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }

  /** Applies current Redroid boot defaults to older app records before start. */
  private async prepareRuntimeDefaults(app: AndroidApplication) {
    const nextContainerArgs = applyRedroidDefaultContainerArgs(
      app.containerImage,
      app.containerArgs,
    );
    if (nextContainerArgs === app.containerArgs) {
      return;
    }

    const previousContainerArgs = app.containerArgs;
    app.containerArgs = nextContainerArgs;

    if (!app.containerId) {
      await this.state.save(app);
      return;
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.running) {
      app.recreateContainerOnNextStart = true;
      app.statusMessage =
        'Runtime boot defaults changed. Stop and start the app to recreate the managed container.';
      await this.state.save(app);
      return;
    }

    await this.logs.append(
      app.id,
      'Recreating container for runtime defaults',
      {
        containerId: app.containerId,
        containerName: app.containerName,
        previousContainerArgs,
        nextContainerArgs,
      },
    );
    await this.removeManagedContainer(app);
    app.recreateContainerOnNextStart = false;
    app.statusMessage =
      'Runtime boot defaults changed. A new container will be created on next start.';
    await this.state.save(app);
  }

  /** Lets a new start request take over a provisioning record left by a dead run. */
  private async recoverStaleProvisioningForStart(app: AndroidApplication) {
    const startedAt = app.provisioningStartedAt?.getTime();
    const staleTimeoutMs =
      this.config.getOrThrow<number>(
        'app.redroid.provisioningStaleTimeoutSeconds',
      ) * 1000;

    if (!startedAt || Date.now() - startedAt < staleTimeoutMs) {
      return false;
    }

    await this.logs.append(app.id, 'Recovering stale provisioning run', {
      containerId: app.containerId,
      containerName: app.containerName,
      lifecycleStage: app.lifecycleStage,
      staleAfterSeconds: staleTimeoutMs / 1000,
    });
    this.tracker.cancel(app.id);
    await this.releaseRuntimeSupportAfterFailedStart(app.id);
    if (app.containerId) {
      await this.removeManagedContainer(app);
    }
    this.tracker.reset(app.id);
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage =
      'Previous provisioning run was stale. A fresh start will be attempted.';
    app.provisioningCompletedAt = new Date();
    app.lastStoppedAt = new Date();
    await this.state.save(app);
    return true;
  }

  /** Removes a failed runtime container so retries do not reuse a wedged Redroid boot. */
  private async prepareFailedContainerForRestart(app: AndroidApplication) {
    if (app.status !== AndroidApplicationStatus.Error || !app.containerId) {
      return;
    }

    await this.logs.append(app.id, 'Removing failed container before restart', {
      containerId: app.containerId,
      containerName: app.containerName,
      lastError: app.lastError,
    });
    await this.removeManagedContainer(app);
    app.recreateContainerOnNextStart = false;
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage =
      'Previous runtime container failed. A fresh container will be created.';
    await this.state.save(app);
  }

  /** Removes the managed container for an app. */
  private async removeManagedContainer(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    await this.networkPolicy.remove(app);
    await this.lifecycle.removeContainer(app.containerId);
    app.containerId = null;
  }

  /** Copies uploaded APK data onto the app record. */
  private applyUploadedApk(app: AndroidApplication, uploadedApk: UploadedApk) {
    if (
      uploadedApk.ownerUserId &&
      app.ownerUserId &&
      uploadedApk.ownerUserId !== app.ownerUserId
    ) {
      throw new ConflictException('Uploaded APK belongs to a different owner.');
    }

    app.uploadedApkId = uploadedApk.id;
    app.apkFilePath = uploadedApk.filePath;
    app.apkOriginalName = uploadedApk.originalName;
    app.apkPackageName = null;
  }

  /** Blocks actions on removed apps. */
  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException(
        'Removed applications cannot be started or updated.',
      );
    }
  }
}
