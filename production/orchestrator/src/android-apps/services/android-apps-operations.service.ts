import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApkCatalogService } from '../../apk/apk-catalog.service';
import { UploadedApk } from '../../apk/uploaded-apk.entity';
import { DockerRuntimeService } from '../../docker/docker-runtime.service';
import { NetworkIsolationService } from '../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../network-policy/network-policy.service';
import { SettingsService } from '../../settings/settings.service';
import { AndroidApplication } from '../android-application.entity';
import { ApplicationProfileMode } from '../application-profile-mode';
import { AndroidApplicationLifecycleStage, AndroidApplicationStatus } from '../android-application-status';
import { CreateAndroidApplicationDto } from '../dto/create-android-application.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsProvisioningService } from './android-apps-provisioning.service';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from './android-apps-state.service';
import { AndroidAppsStatusService } from './android-apps-status.service';

@Injectable()
export class AndroidAppsOperationsService {
  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly docker: DockerRuntimeService,
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly settings: SettingsService,
    private readonly apks: ApkCatalogService,
    private readonly provisioning: AndroidAppsProvisioningService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly state: AndroidAppsStateService,
    private readonly status: AndroidAppsStatusService,
  ) {}

  async create(dto: CreateAndroidApplicationDto) {
    const settings = await this.settings.getSettings();
    const uploadedApk = dto.uploadedApkId
      ? await this.apks.get(dto.uploadedApkId)
      : null;

    const app = this.applications.create({
      name: dto.name,
      ownerUserId: dto.ownerUserId ?? null,
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.Queued,
      statusMessage: 'Provisioning has been queued.',
      containerImage: dto.containerImage ?? settings.defaultContainerImage,
      containerName: 'pending',
      networkName: 'pending',
      volumeName: 'pending',
      containerId: null,
      apkFilePath: null,
      apkOriginalName: null,
      uploadedApkId: null,
      scrcpyTransport: settings.defaultScrcpyTransport,
      adbPort: this.config.getOrThrow<number>('app.redroid.adbPort'),
      inactivityTimeoutSeconds:
        dto.inactivityTimeoutSeconds ?? settings.defaultInactivityTimeoutSeconds,
      profileMode: ApplicationProfileMode.Persistent,
      profileName: 'default',
      memoryLimitMb: dto.memoryLimitMb ?? null,
      cpuLimitCpus: dto.cpuLimitCpus ?? null,
      volumeSizeLimitMb: dto.volumeSizeLimitMb ?? null,
      containerArgs: dto.containerArgs?.trim() || null,
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

    const names = this.networkIsolation.namesFor(app.id, app.name, app.profileName);
    Object.assign(app, names);

    if (uploadedApk) {
      this.applyUploadedApk(app, uploadedApk);
    }

    await this.state.save(app);
    this.tracker.reset(app.id);

    void this.provisioning.provision(app.id);

    return this.state.decorateApplication(app);
  }

  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.state.get(id);
    const shouldRecreateContainer = this.shouldRecreateContainerOnUpdate(app, dto);

    if (dto.name !== undefined) {
      app.name = dto.name;
    }
    if (dto.ownerUserId !== undefined) {
      app.ownerUserId = dto.ownerUserId;
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
      app.containerArgs = dto.containerArgs?.trim() || null;
    }

    if (shouldRecreateContainer) {
      await this.markContainerForRecreation(app);
    }

    return this.state.saveAndDecorate(app);
  }

  async updateNetworkPolicy(id: string, dto: UpdateNetworkPolicyDto) {
    const app = await this.state.get(id);
    if (dto.networkPolicyEnabled !== undefined) {
      app.networkPolicyEnabled = dto.networkPolicyEnabled;
    }
    if (dto.networkPolicyAllowCidrs !== undefined) {
      app.networkPolicyAllowCidrs = JSON.stringify(dto.networkPolicyAllowCidrs);
    }

    await this.state.save(app);
    return this.applyNetworkPolicy(id);
  }

  async applyNetworkPolicy(id: string) {
    const app = await this.state.get(id);
    const result = await this.networkPolicy.apply(app);
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    return this.state.saveAndDecorate(app);
  }

  async switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    if (app.containerId) {
      await this.networkPolicy.remove(app);
      await this.docker.removeContainer(app.containerId);
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

  async start(id: string, dto: StartAndroidApplicationDto = {}) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    if (dto.profileMode !== undefined || dto.profileName !== undefined) {
      await this.prepareRuntimeProfile(app, dto);
    }

    await this.state.clearMissingContainerReference(app);
    await this.prepareContainerForRecreationOnStart(app);

    await this.state.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting application container.',
      lastError: null,
    });

    if (!(await this.docker.imageExists(app.containerImage))) {
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
        statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
      });
      await this.docker.pullImage(app.containerImage, (message) => {
        void this.state.setLifecycle(app.id, {
          statusMessage: message || `Pulling ${app.containerImage}.`,
        });
      });
    }

    if (!app.containerId) {
      if (app.profileMode === ApplicationProfileMode.Persistent) {
        await this.docker.createVolume(app.id, app.volumeName);
      }
      await this.docker.createIsolatedNetwork(app.id, app.networkName);
      await this.docker.connectOrchestratorToNetwork(app.networkName);
      const container = await this.docker.createApplicationContainer({
        applicationId: app.id,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
        image: app.containerImage,
        dataMountPath: this.config.getOrThrow<string>('app.redroid.dataMountPath'),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
        profileMode: app.profileMode,
        memoryLimitMb: app.memoryLimitMb,
        cpuLimitCpus: app.cpuLimitCpus,
        containerArgs: app.containerArgs,
      });
      app.containerId = container.id;
      app.recreateContainerOnNextStart = false;
      await this.state.save(app);
    }

    await this.docker.startContainer(app.containerId);
    await this.applyNetworkPolicy(app.id);

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage = 'Application is running.';
    app.lastStartedAt = new Date();
    app.lastError = null;
    return this.state.saveAndDecorate(app);
  }

  async stop(id: string) {
    const app = await this.state.get(id);

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopping;
    app.statusMessage = 'Stopping application container.';
    await this.state.save(app);

    if (app.containerId) {
      await this.docker.stopContainer(app.containerId);
    }

    if (app.recreateContainerOnNextStart && app.containerId) {
      await this.removeManagedContainer(app);
      app.recreateContainerOnNextStart = false;
    }

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = this.status.stoppedStatusMessage(app);
    app.lastStoppedAt = new Date();
    return this.state.saveAndDecorate(app);
  }

  async updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    const uploadedApk = await this.apks.get(dto.uploadedApkId);
    this.applyUploadedApk(app, uploadedApk);
    await this.state.save(app);

    if (app.status === AndroidApplicationStatus.Running) {
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
        statusMessage: 'Installing updated APK.',
      });
      await this.provisioning.installApk(app);
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
      });
    }

    return this.state.saveAndDecorate(app);
  }

  async remove(id: string, query: RemoveAndroidApplicationDto) {
    const app = await this.state.get(id);
    this.tracker.cancel(id);
    app.status = AndroidApplicationStatus.Removing;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Removing;
    app.statusMessage = 'Removing application container and network resources.';
    await this.state.save(app);

    if (app.containerId) {
      await this.networkPolicy.remove(app);
      await this.docker.removeContainer(app.containerId);
      app.containerId = null;
    }
    await this.docker.removeContainerByName(app.containerName);

    await this.docker.removeNetwork(app.networkName);
    const removeData = query.removeData ?? true;
    if (removeData) {
      await this.docker.removeVolume(app.volumeName);
    }

    await this.applications.remove(app);

    return {
      id,
      deleted: true,
      removedData: removeData,
    };
  }

  async scrcpySession(id: string): Promise<ScrcpySessionDto> {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    if (app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before opening scrcpy.',
      );
    }

    const udid = `${app.containerName}:${app.adbPort}`;
    const proxyRemote =
      this.config.get<string>('app.scrcpy.wsScrcpyProxyRemote') ??
      `tcp:${app.adbPort}`;
    const sidecarTarget = await this.docker.ensureWsScrcpySidecarOnNetwork(
      app.networkName,
    );
    const viewerTarget =
      sidecarTarget.configured && sidecarTarget.connected
        ? await this.prepareScrcpyAdbTarget(app)
        : sidecarTarget;
    app.lastScrcpyActivityAt = new Date();
    await this.state.save(app);

    return {
      applicationId: app.id,
      transport: app.scrcpyTransport,
      udid,
      proxyRemote,
      player: this.config.getOrThrow<string>('app.scrcpy.wsScrcpyPlayer'),
      viewerServiceConfigured: viewerTarget.configured,
      viewerTargetConnected: viewerTarget.connected,
      viewerMessage: viewerTarget.message,
      viewerError: viewerTarget.error,
      adbHost: app.containerName,
      adbPort: app.adbPort,
    };
  }

  async recordViewerActivity(id: string) {
    const app = await this.state.get(id);
    if (app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before viewer activity can be refreshed.',
      );
    }

    app.lastScrcpyActivityAt = new Date();
    await this.state.save(app);

    return {
      id: app.id,
      lastScrcpyActivityAt: app.lastScrcpyActivityAt.toISOString(),
    };
  }

  async notifications(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return [];
    }

    const { stdout } = await this.docker.execInContainerWithOutput(
      app.containerId,
      [
        'sh',
        '-lc',
        'cmd notification list --noredact 2>/dev/null || dumpsys notification --noredact 2>/dev/null | head -n 200',
      ],
    );

    return this.status.parseNotifications(stdout);
  }

  async containerLogs(id: string, tail = 300) {
    const app = await this.state.get(id);
    if (!app.containerId) {
      return {
        source: 'container' as const,
        collectedAt: new Date().toISOString(),
        output: 'No container has been created for this application yet.',
      };
    }

    return {
      source: 'container' as const,
      collectedAt: new Date().toISOString(),
      output: await this.docker.getContainerLogs(app.containerId, tail),
    };
  }

  async adbLogs(id: string, tail = 300) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return {
        source: 'adb' as const,
        collectedAt: new Date().toISOString(),
        output:
          'ADB logs are available after the Android container is running.',
      };
    }

    const { stdout, stderr } = await this.docker.execInContainerWithOutput(
      app.containerId,
      [
        'sh',
        '-lc',
        `logcat -d -t ${Math.max(1, Math.min(tail, 2000))} 2>&1 || true`,
      ],
    );

    return {
      source: 'adb' as const,
      collectedAt: new Date().toISOString(),
      output: stdout || stderr,
    };
  }

  private async prepareScrcpyAdbTarget(app: AndroidApplication) {
    await this.applyNetworkPolicy(app.id);
    return this.docker.connectWsScrcpyAdb(app.containerName, app.adbPort);
  }

  private async prepareRuntimeProfile(
    app: AndroidApplication,
    dto: StartAndroidApplicationDto,
  ) {
    const nextProfileMode = dto.profileMode ?? app.profileMode;
    const nextProfileName = dto.profileName?.trim() || app.profileName || 'default';
    const nextVolumeName = this.networkIsolation.namesFor(
      app.id,
      app.name,
      nextProfileName,
    ).volumeName;
    const profileChanged =
      nextProfileMode !== app.profileMode ||
      nextProfileName !== app.profileName ||
      nextVolumeName !== app.volumeName;

    if (!profileChanged) {
      return;
    }

    if (app.containerId) {
      await this.networkPolicy.remove(app);
      await this.docker.removeContainer(app.containerId);
      app.containerId = null;
    }

    app.profileMode = nextProfileMode;
    app.profileName = nextProfileName;
    app.volumeName = nextVolumeName;
    await this.state.save(app);
  }

  private shouldRecreateContainerOnUpdate(
    app: AndroidApplication,
    dto: UpdateAndroidApplicationDto,
  ) {
    return (
      (dto.memoryLimitMb !== undefined && dto.memoryLimitMb !== app.memoryLimitMb) ||
      (dto.cpuLimitCpus !== undefined && dto.cpuLimitCpus !== app.cpuLimitCpus) ||
      (dto.containerArgs !== undefined &&
        (dto.containerArgs?.trim() || null) !== app.containerArgs)
    );
  }

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

  private async prepareContainerForRecreationOnStart(app: AndroidApplication) {
    if (!app.recreateContainerOnNextStart) {
      return;
    }

    if (!app.containerId) {
      app.recreateContainerOnNextStart = false;
      await this.state.save(app);
      return;
    }

    const runtimeState = await this.docker.getContainerRuntimeState(app.containerId);
    if (runtimeState.running) {
      throw new ConflictException(
        'Runtime settings changed. Stop the app before starting it again so the managed container can be recreated.',
      );
    }

    await this.removeManagedContainer(app);
    app.recreateContainerOnNextStart = false;
    await this.state.save(app);
  }

  private async removeManagedContainer(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    await this.networkPolicy.remove(app);
    await this.docker.removeContainer(app.containerId);
    app.containerId = null;
  }

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
  }

  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException(
        'Removed applications cannot be started or updated.',
      );
    }
  }
}