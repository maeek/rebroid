import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApkService } from '../apk/apk.service';
import { UploadedApk } from '../apk/uploaded-apk.entity';
import { throwNotFound } from '../common/not-found';
import { ContainerRuntimeState, DockerService } from '../docker/docker.service';
import { NetworkIsolationService } from '../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../network-policy/network-policy.service';
import { SettingsService } from '../settings/settings.service';
import { AndroidApplication } from './android-application.entity';
import { ApplicationProfileMode } from './application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from './android-application-status';
import { CreateAndroidApplicationDto } from './dto/create-android-application.dto';
import { ListAndroidApplicationsDto } from './dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from './dto/remove-android-application.dto';
import { ScrcpySessionDto } from './dto/scrcpy-session.dto';
import { StartAndroidApplicationDto } from './dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from './dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from './dto/update-android-application-apk.dto';
import { UpdateAndroidApplicationDto } from './dto/update-android-application.dto';
import { UpdateNetworkPolicyDto } from './dto/update-network-policy.dto';

@Injectable()
export class AndroidAppsService {
  private readonly logger = new Logger(AndroidAppsService.name);
  private readonly cancelledProvisioning = new Set<string>();

  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly docker: DockerService,
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly settings: SettingsService,
    private readonly apks: ApkService,
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
        dto.inactivityTimeoutSeconds ??
        settings.defaultInactivityTimeoutSeconds,
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

    await this.applications.save(app);

    const names = this.networkIsolation.namesFor(
      app.id,
      app.name,
      app.profileName,
    );
    Object.assign(app, names);

    if (uploadedApk) {
      this.applyUploadedApk(app, uploadedApk);
    }

    await this.applications.save(app);
    this.cancelledProvisioning.delete(app.id);

    void this.provision(app.id);

    return app;
  }

  async list(query: ListAndroidApplicationsDto) {
    const apps = await this.applications.find({
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
    return Promise.all(apps.map((app) => this.reconcileContainerState(app)));
  }

  async get(id: string) {
    const app =
      (await this.applications.findOneBy({ id })) ??
      throwNotFound('Application', id);
    return this.reconcileContainerState(app);
  }

  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.get(id);
    const shouldRecreateContainer = this.shouldRecreateContainerOnUpdate(
      app,
      dto,
    );

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

    return this.applications.save(app);
  }

  async updateNetworkPolicy(id: string, dto: UpdateNetworkPolicyDto) {
    const app = await this.get(id);
    if (dto.networkPolicyEnabled !== undefined) {
      app.networkPolicyEnabled = dto.networkPolicyEnabled;
    }
    if (dto.networkPolicyAllowCidrs !== undefined) {
      app.networkPolicyAllowCidrs = JSON.stringify(dto.networkPolicyAllowCidrs);
    }

    await this.applications.save(app);
    return this.applyNetworkPolicy(id);
  }

  async applyNetworkPolicy(id: string) {
    const app = await this.get(id);
    const result = await this.networkPolicy.apply(app);
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    return this.applications.save(app);
  }

  async switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    const app = await this.get(id);
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

    return this.applications.save(app);
  }

  async start(id: string, dto: StartAndroidApplicationDto = {}) {
    const app = await this.get(id);
    this.assertRunnable(app);

    if (dto.profileMode !== undefined || dto.profileName !== undefined) {
      await this.prepareRuntimeProfile(app, dto);
    }

    await this.clearMissingContainerReference(app);
    await this.prepareContainerForRecreationOnStart(app);

    await this.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting application container.',
      lastError: null,
    });

    if (!(await this.docker.imageExists(app.containerImage))) {
      await this.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
        statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
      });
      await this.docker.pullImage(app.containerImage, (message) => {
        void this.setLifecycle(app.id, {
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
        dataMountPath: this.config.getOrThrow<string>(
          'app.redroid.dataMountPath',
        ),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
        profileMode: app.profileMode,
        memoryLimitMb: app.memoryLimitMb,
        cpuLimitCpus: app.cpuLimitCpus,
        containerArgs: app.containerArgs,
      });
      app.containerId = container.id;
      app.recreateContainerOnNextStart = false;
      await this.applications.save(app);
    }

    await this.docker.startContainer(app.containerId);
    await this.applyNetworkPolicy(app.id);

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage = 'Application is running.';
    app.lastStartedAt = new Date();
    app.lastError = null;
    return this.applications.save(app);
  }

  async stop(id: string) {
    const app = await this.get(id);

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopping;
    app.statusMessage = 'Stopping application container.';
    await this.applications.save(app);

    if (app.containerId) {
      await this.docker.stopContainer(app.containerId);
    }

    if (app.recreateContainerOnNextStart && app.containerId) {
      await this.removeManagedContainer(app);
      app.recreateContainerOnNextStart = false;
    }

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = app.containerId
      ? 'Application is stopped.'
      : 'Application is stopped. A new container will be created on next start.';
    app.lastStoppedAt = new Date();
    return this.applications.save(app);
  }

  async updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    const app = await this.get(id);
    this.assertRunnable(app);

    const uploadedApk = await this.apks.get(dto.uploadedApkId);
    this.applyUploadedApk(app, uploadedApk);
    await this.applications.save(app);

    if (app.status === AndroidApplicationStatus.Running) {
      await this.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
        statusMessage: 'Installing updated APK.',
      });
      await this.installApk(app);
      await this.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
      });
    }

    return this.applications.save(app);
  }

  async remove(id: string, query: RemoveAndroidApplicationDto) {
    const app = await this.get(id);
    this.cancelledProvisioning.add(id);
    app.status = AndroidApplicationStatus.Removing;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Removing;
    app.statusMessage = 'Removing application container and network resources.';
    await this.applications.save(app);

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

  async touchScrcpyActivity(id: string) {
    const app = await this.get(id);
    app.lastScrcpyActivityAt = new Date();
    return this.applications.save(app);
  }

  async scrcpySession(
    id: string,
    publicBaseUrl?: string,
  ): Promise<ScrcpySessionDto> {
    const app = await this.get(id);
    this.assertRunnable(app);

    if (app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before opening scrcpy.',
      );
    }

    const baseUrl = publicBaseUrl?.replace(/\/$/, '') ?? '';
    return {
      applicationId: app.id,
      transport: app.scrcpyTransport,
      websocketUrl: `${baseUrl}/scrcpy?applicationId=${app.id}`,
      adbHost: app.containerName,
      adbPort: app.adbPort,
    };
  }

  async notifications(id: string) {
    const app = await this.get(id);
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

    return this.parseNotifications(stdout);
  }

  async containerLogs(id: string, tail = 300) {
    const app = await this.get(id);
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
    const app = await this.get(id);
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
    await this.applications.save(app);
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
      await this.applications.save(app);
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
    await this.applications.save(app);
  }

  private async removeManagedContainer(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    await this.networkPolicy.remove(app);
    await this.docker.removeContainer(app.containerId);
    app.containerId = null;
  }

  async findInactiveRunningApplications(now = new Date()) {
    const running = await this.applications.findBy({
      status: AndroidApplicationStatus.Running,
    });

    return running.filter((app) => {
      const lastActivity = app.lastScrcpyActivityAt ?? app.lastStartedAt;
      if (!lastActivity) {
        return false;
      }

      const inactiveSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
      return inactiveSeconds >= app.inactivityTimeoutSeconds;
    });
  }

  private async provision(applicationId: string) {
    try {
      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Provisioning,
        lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
        statusMessage:
          'Checking whether the container image is available locally.',
        provisioningStartedAt: new Date(),
        lastError: null,
      });

      const app = await this.get(applicationId);
      this.ensureProvisioningActive(applicationId);

      if (!(await this.docker.imageExists(app.containerImage))) {
        this.ensureProvisioningActive(applicationId);
        await this.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
          statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
        });

        await this.docker.pullImage(app.containerImage, (message) => {
          void this.setLifecycle(applicationId, {
            statusMessage: message || `Pulling ${app.containerImage}.`,
          });
        });
        this.ensureProvisioningActive(applicationId);
      }

      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.VolumeCreating,
        statusMessage: `Creating persistent data volume ${app.volumeName}.`,
      });
      if (app.profileMode === ApplicationProfileMode.Persistent) {
        await this.docker.createVolume(app.id, app.volumeName);
      }

      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.NetworkCreating,
        statusMessage: `Creating isolated internal network ${app.networkName}.`,
      });
      await this.docker.createIsolatedNetwork(app.id, app.networkName);

      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage:
          AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting,
        statusMessage: 'Connecting orchestrator to the isolated app network.',
      });
      await this.docker.connectOrchestratorToNetwork(app.networkName);

      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
        statusMessage: `Creating application container ${app.containerName}.`,
      });
      const container = await this.docker.createApplicationContainer({
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
      });

      this.ensureProvisioningActive(applicationId);
      await this.applications.update(app.id, {
        containerId: container.id,
      });

      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Starting application container.',
      });
      await this.docker.startContainer(container.id);
      await this.applyNetworkPolicy(app.id);
      this.ensureProvisioningActive(applicationId);
      await this.applications.update(app.id, {
        lastStartedAt: new Date(),
      });

      if (app.apkFilePath) {
        this.ensureProvisioningActive(applicationId);
        await this.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
          statusMessage:
            'Waiting for Android to finish booting before APK install.',
        });
        await this.installApk({ ...app, containerId: container.id });
      }

      this.ensureProvisioningActive(applicationId);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
        provisioningCompletedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      if (this.isProvisioningCancelled(error)) {
        this.logger.log(`Provisioning cancelled for ${applicationId}.`);
        return;
      }

      const message = this.errorMessage(error);
      this.logger.error(`Provisioning failed for ${applicationId}: ${message}`);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Error,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: message,
        lastError: message,
      });
    }
  }

  private async installApk(app: AndroidApplication) {
    if (!app.containerId || !app.apkFilePath) {
      throw new InternalServerErrorException('Container and APK are required.');
    }

    const targetDir = '/data/local/tmp';
    const targetName = `${app.id}.apk`;

    await this.docker.copyFileToContainer(
      app.containerId,
      app.apkFilePath,
      targetDir,
      targetName,
    );
    await this.waitForAndroidBoot(app.containerId);
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage: 'Installing APK inside Android.',
    });
    await this.docker.execInContainer(app.containerId, [
      'sh',
      '-lc',
      `pm install -r ${targetDir}/${targetName}`,
    ]);
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

  private parseNotifications(output: string) {
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /Notification|pkg=|package=/i.test(line))
      .slice(0, 30)
      .map((line) => {
        const packageName =
          line.match(/pkg=([^\s]+)/)?.[1] ??
          line.match(/package=([^\s]+)/)?.[1] ??
          'android';
        const title =
          line.match(/title=([^,]+)/)?.[1]?.trim() ??
          line.match(/tickerText=([^,]+)/)?.[1]?.trim() ??
          packageName;
        const text =
          line.match(/text=([^,]+)/)?.[1]?.trim() ??
          line.match(/content=([^,]+)/)?.[1]?.trim() ??
          line;

        return { packageName, title, text, raw: line };
      });
  }

  private async waitForAndroidBoot(containerId: string) {
    await this.docker.execInContainer(containerId, [
      'sh',
      '-lc',
      'i=0; while [ "$i" -lt 60 ]; do [ "$(getprop sys.boot_completed 2>/dev/null)" = "1" ] && exit 0; i=$((i+1)); sleep 2; done; exit 1',
    ]);
  }

  private async clearMissingContainerReference(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    const runtimeState = await this.docker.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.exists) {
      return;
    }

    await this.networkPolicy.remove(app);
    app.containerId = null;
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage =
      'Managed container was removed. A new container will be created on start.';
    app.lastStoppedAt = new Date();
    await this.applications.save(app);
  }

  private async reconcileContainerState(app: AndroidApplication) {
    if (!this.shouldReconcileContainerState(app)) {
      return app;
    }

    const containerId = app.containerId;
    if (!containerId) {
      return app;
    }

    let runtimeState: ContainerRuntimeState;
    try {
      runtimeState = await this.docker.getContainerRuntimeState(containerId);
    } catch (error) {
      this.logger.warn(
        `Could not inspect container state for ${app.id}: ${this.errorMessage(error)}`,
      );
      return app;
    }

    if (runtimeState.exists && runtimeState.running) {
      return app;
    }

    const message = runtimeState.exists
      ? this.containerExitedMessage(app, runtimeState)
      : 'Managed container no longer exists.';

    if (app.status === AndroidApplicationStatus.Provisioning) {
      if (!runtimeState.exists) {
        await this.networkPolicy.remove(app);
        app.containerId = null;
      }
      app.status = AndroidApplicationStatus.Error;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Error;
      app.statusMessage = message;
      app.lastError = message;
      app.lastStoppedAt = new Date();
      this.cancelledProvisioning.add(app.id);
      return this.applications.save(app);
    }

    if (app.status === AndroidApplicationStatus.Running) {
      if (!runtimeState.exists) {
        await this.networkPolicy.remove(app);
        app.containerId = null;
      }
      app.status = AndroidApplicationStatus.Error;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Error;
      app.statusMessage = message;
      app.lastError = message;
      app.lastStoppedAt = new Date();
      return this.applications.save(app);
    }

    return app;
  }

  private shouldReconcileContainerState(app: AndroidApplication) {
    return (
      Boolean(app.containerId) &&
      (app.status === AndroidApplicationStatus.Provisioning ||
        app.status === AndroidApplicationStatus.Running)
    );
  }

  private containerExitedMessage(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    const status = runtimeState.status ?? 'exited';
    const exitCode =
      runtimeState.exitCode === null || runtimeState.exitCode === undefined
        ? ''
        : ` with exit code ${runtimeState.exitCode}`;
    const dockerError = runtimeState.error
      ? ` Docker reported: ${runtimeState.error}`
      : '';
    const context =
      app.status === AndroidApplicationStatus.Provisioning
        ? ' before provisioning completed'
        : '';

    const startupHint =
      app.status === AndroidApplicationStatus.Provisioning &&
      runtimeState.exitCode === 0
        ? app.containerArgs?.trim()
          ? ' The configured container command completed immediately. Managed apps need a long-running primary process.'
          : ' The image likely finished its default command immediately. Managed apps need a long-running primary process, so plain images such as ubuntu usually require container arguments like "sleep infinity".'
        : '';

    return `Managed container ${status}${exitCode}${context}.${startupHint}${dockerError}`;
  }

  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException(
        'Removed applications cannot be started or updated.',
      );
    }
  }

  private async setLifecycle(
    applicationId: string,
    patch: Partial<
      Pick<
        AndroidApplication,
        | 'status'
        | 'lifecycleStage'
        | 'statusMessage'
        | 'lastError'
        | 'provisioningStartedAt'
        | 'provisioningCompletedAt'
      >
    >,
  ) {
    await this.applications.update(applicationId, patch);
  }

  private ensureProvisioningActive(applicationId: string) {
    if (this.cancelledProvisioning.has(applicationId)) {
      throw new Error(`Provisioning cancelled for ${applicationId}`);
    }
  }

  private isProvisioningCancelled(error: unknown) {
    return (
      error instanceof Error &&
      error.message.startsWith('Provisioning cancelled for ')
    );
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    this.logger.error(error);
    return 'Unknown error';
  }
}
