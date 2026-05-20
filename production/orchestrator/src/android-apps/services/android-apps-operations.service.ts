import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { basename } from 'node:path';
import { Repository } from 'typeorm';
import { ApkCatalogService } from '../../apk/apk-catalog.service';
import { UploadedApk } from '../../apk/uploaded-apk.entity';
import { getErrorMessage } from '../../common/error-message';
import { DockerRuntimeService } from '../../docker/docker-runtime.service';
import { NetworkIsolationService } from '../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../network-policy/network-policy.service';
import { SettingsService } from '../../settings/settings.service';
import { AndroidApplication } from '../android-application.entity';
import { ApplicationProfileMode } from '../application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../android-application-status';
import { CloneAndroidApplicationDto } from '../dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../dto/create-android-application.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { applyRedroidDefaultContainerArgs } from '../utils/redroid-runtime.utils';
import { AndroidAppsProvisioningService } from './android-apps-provisioning.service';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';
import { AndroidAppsLogService } from './android-apps-log.service';
import { AndroidAppsStateService } from './android-apps-state.service';
import { AndroidAppsStatusService } from './android-apps-status.service';

@Injectable()
export class AndroidAppsOperationsService {
  private readonly logger = new Logger(AndroidAppsOperationsService.name);
  private readonly downloadDirectory = '/sdcard/Download';

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
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
    private readonly status: AndroidAppsStatusService,
  ) {}

  /**
   * Creates the application record and starts provisioning in the background.
   * Callers should expect a queued app before any Docker resources exist.
   */
  async create(dto: CreateAndroidApplicationDto) {
    const settings = await this.settings.getSettings();
    const uploadedApk = dto.uploadedApkId
      ? await this.apks.get(dto.uploadedApkId)
      : null;

    const containerImage = this.resolveContainerImage(
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

  /**
   * Creates an owner-scoped copy of an existing app definition.
   * Runtime state, containers, volumes, and viewer sessions are never shared.
   */
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

  /**
   * Updates editable metadata and flags runtime-only changes for container recreation.
   * Running containers are not recreated in place.
   */
  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.state.get(id);
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

  /**
   * Persists network policy settings and reapplies rules immediately.
   * Resolution failures are surfaced by the follow-up apply step.
   */
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

  /**
   * Recomputes and stores the current network policy result for the app.
   * This can be skipped while the container is still being created.
   */
  async applyNetworkPolicy(id: string) {
    const app = await this.state.get(id);
    const result = await this.networkPolicy.apply(app);
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    return this.state.saveAndDecorate(app);
  }

  /**
   * Switches the active profile by discarding any existing managed container first.
   * The next start recreates runtime state for the selected profile.
   */
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

  /**
   * Starts the managed container, creating missing runtime resources on demand.
   * Restart is blocked when runtime settings require a stopped container first.
   */
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
    await this.logs.append(app.id, 'Start requested', {
      profileMode: app.profileMode,
      profileName: app.profileName,
      existingContainerId: app.containerId,
      image: app.containerImage,
    });
    await this.logs.append(
      app.id,
      'Container engine selected',
      await this.docker.engineSummary(),
    );

    if (!(await this.docker.imageExists(app.containerImage))) {
      await this.state.setLifecycle(app.id, {
        lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
        statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
      });
      await this.docker.pullImage(app.containerImage, (message) => {
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

    if (!app.containerId) {
      if (app.profileMode === ApplicationProfileMode.Persistent) {
        await this.docker.createVolume(app.id, app.volumeName);
      }
      await this.docker.createIsolatedNetwork(app.id, app.networkName);
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
        securityOptions: this.config.getOrThrow<string[]>(
          'app.redroid.securityOptions',
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
    }

    await this.docker.connectOrchestratorToNetwork(app.networkName);
    await this.prepareViewerNetwork(app);

    await this.docker.startContainer(app.containerId);
    await this.logs.append(app.id, 'Container start requested', {
      containerId: app.containerId,
    });
    await this.applyNetworkPolicy(app.id);

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage = 'Application is running.';
    app.lastStartedAt = new Date();
    app.lastError = null;
    await this.logs.append(app.id, 'Application marked running', {
      containerId: app.containerId,
    });
    return this.state.saveAndDecorate(app);
  }

  /**
   * Stops the managed container and removes it when recreation is already pending.
   * The app record still ends in a stopped state even if no container exists.
   */
  async stop(id: string) {
    const app = await this.state.get(id);

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopping;
    app.statusMessage = 'Stopping application container.';
    await this.state.save(app);
    await this.logs.append(app.id, 'Stop requested', {
      containerId: app.containerId,
    });

    if (app.containerId) {
      await this.docker.stopContainer(app.containerId);
    }

    await this.releaseViewerNetwork(app);

    if (app.recreateContainerOnNextStart && app.containerId) {
      await this.removeManagedContainer(app);
      app.recreateContainerOnNextStart = false;
    }

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = this.status.stoppedStatusMessage(app);
    app.lastStoppedAt = new Date();
    await this.logs.append(app.id, 'Application stopped', {
      containerId: app.containerId,
      recreateContainerOnNextStart: app.recreateContainerOnNextStart,
    });
    return this.state.saveAndDecorate(app);
  }

  /**
   * Replaces the APK reference and installs it immediately when the app is running.
   * Ownership checks are enforced before the APK metadata is copied onto the app.
   */
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

  /**
   * Removes the application record together with its managed Docker resources.
   * Volume data is deleted unless removeData is explicitly false.
   */
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
    await this.logs.remove(id);

    return {
      id,
      deleted: true,
      removedData: removeData,
    };
  }

  /**
   * Prepares viewer connection details and refreshes scrcpy activity tracking.
   * The app must already be running because the ADB target comes from the container.
   */
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
    const adbHost = await this.resolveScrcpyAdbHost(app);
    const viewerTarget =
      sidecarTarget.configured && sidecarTarget.connected
        ? await this.prepareScrcpyAdbTarget(app, adbHost)
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
      adbHost,
      adbPort: app.adbPort,
    };
  }

  /**
   * Refreshes the inactivity timer from viewer-side pings.
   * Only running applications can accept activity updates.
   */
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

  /**
   * Reads recent Android notifications from the running container.
   * Returns an empty list when the runtime is not available.
   */
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

  /**
   * Returns recent Docker logs or a placeholder when the container was never created.
   */
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

  /**
   * Reads orchestrator-side lifecycle and runtime events for an application.
   * This is useful when the container itself writes little or no stdout.
   */
  async eventLogs(id: string, tail = 300) {
    await this.state.get(id);
    return {
      source: 'orchestrator' as const,
      collectedAt: new Date().toISOString(),
      output: await this.logs.read(id, tail),
    };
  }

  /**
   * Dumps recent logcat output from the running Android runtime.
   * Tail is clamped to avoid expensive reads from the container.
   */
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

  /**
   * Lists files from the Android Download directory used by the viewer transfer panel.
   */
  async listDownloadFiles(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const { stdout } = await this.docker.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          `dir="${this.downloadDirectory}"`,
          'mkdir -p "$dir"',
          'find "$dir" -maxdepth 1 -type f -print 2>/dev/null | while IFS= read -r file; do',
          'name=${file##*/}',
          'size=$(stat -c %s "$file" 2>/dev/null || wc -c < "$file" 2>/dev/null || echo 0)',
          'modified=$(stat -c %Y "$file" 2>/dev/null || echo 0)',
          'printf "%s\\t%s\\t%s\\n" "$name" "$size" "$modified"',
          'done',
        ].join('\n'),
      ],
    );

    return this.parseDownloadFiles(stdout);
  }

  /**
   * Uploads a browser-provided file into the app container Download directory.
   */
  async uploadDownloadFile(id: string, file?: Express.Multer.File) {
    if (!file) {
      throw new ConflictException('A file upload is required.');
    }

    const app = await this.getRunningRuntimeApp(id);
    const fileName = this.sanitizeRuntimeFileName(file.originalname);
    await this.docker.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `mkdir -p "${this.downloadDirectory}"`,
    ]);
    await this.docker.copyBufferToContainer(
      app.containerId!,
      file.buffer,
      this.downloadDirectory,
      fileName,
    );

    return {
      uploaded: true,
      name: fileName,
      path: `${this.downloadDirectory}/${fileName}`,
      sizeBytes: file.size,
      modifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Downloads a file from the app container Download directory as a browser data URL.
   */
  async downloadFile(id: string, fileName: string) {
    const app = await this.getRunningRuntimeApp(id);
    const safeFileName = this.sanitizeRuntimeFileName(fileName);
    const content = await this.docker.readFileFromContainer(
      app.containerId!,
      `${this.downloadDirectory}/${safeFileName}`,
    );

    return {
      name: safeFileName,
      mimeType: 'application/octet-stream',
      dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
    };
  }

  async getClipboard(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const { stdout } = await this.docker.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        'if command -v cmd >/dev/null 2>&1; then cmd clipboard get 2>/dev/null || true; else echo __SMA_UNSUPPORTED__; fi',
      ],
    );
    const text = stdout.replace(/\r?\n$/, '');
    const supported = text !== '__SMA_UNSUPPORTED__';

    return {
      text: supported ? text : '',
      supported,
      message: supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  async setClipboard(id: string, text: string) {
    const app = await this.getRunningRuntimeApp(id);
    const encoded = Buffer.from(text, 'utf-8').toString('base64');
    const { stdout } = await this.docker.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          'if command -v cmd >/dev/null 2>&1; then',
          `text=$(printf '%s' '${encoded}' | base64 -d 2>/dev/null)`,
          'cmd clipboard set "$text" >/dev/null 2>&1 && echo __SMA_OK__ || echo __SMA_UNSUPPORTED__',
          'else echo __SMA_UNSUPPORTED__',
          'fi',
        ].join(' '),
      ],
    );
    const supported = stdout.trim() !== '__SMA_UNSUPPORTED__';

    return {
      text: supported ? text : '',
      supported,
      message: supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  async screenshot(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const { stdout } = await this.docker.execInContainerWithOutput(
      app.containerId!,
      ['sh', '-lc', 'screencap -p 2>/dev/null | base64 | tr -d "\\n" || true'],
    );
    const base64 = stdout.trim();
    if (!base64) {
      throw new ConflictException(
        'Screenshot capture is not available in this container image.',
      );
    }

    return {
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${base64}`,
      capturedAt: new Date().toISOString(),
    };
  }

  private async prepareScrcpyAdbTarget(
    app: AndroidApplication,
    adbHost: string,
  ) {
    await this.applyNetworkPolicy(app.id);

    await this.logs.append(app.id, 'Preparing ws-scrcpy ADB target', {
      networkName: app.networkName,
      containerName: app.containerName,
      containerId: app.containerId,
      adbHost,
      adbPort: app.adbPort,
    });

    return this.docker.connectWsScrcpyAdb(adbHost, app.adbPort);
  }

  private async resolveScrcpyAdbHost(app: AndroidApplication) {
    if (!app.containerId) {
      return app.containerName;
    }

    return (
      (await this.docker.getContainerIpOnNetwork(
        app.containerId,
        app.networkName,
      )) ?? app.containerName
    );
  }

  private resolveContainerImage(image: string, registry: string | null) {
    const trimmedImage = image.trim();
    if (!registry) {
      return trimmedImage;
    }

    const firstSegment = trimmedImage.split('/')[0] ?? '';
    const hasExplicitRegistry =
      firstSegment === 'localhost' ||
      firstSegment.includes('.') ||
      firstSegment.includes(':');

    return hasExplicitRegistry
      ? trimmedImage
      : `${registry.replace(/\/+$/, '')}/${trimmedImage}`;
  }

  private async getRunningRuntimeApp(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }

  private sanitizeRuntimeFileName(fileName: string) {
    const normalized = basename(fileName.replace(/\\/g, '/')).trim();
    if (
      !normalized ||
      normalized === '.' ||
      normalized === '..' ||
      normalized.includes('/') ||
      normalized.includes('\\') ||
      normalized.includes('\0')
    ) {
      throw new ConflictException('Invalid file name.');
    }

    return normalized;
  }

  private parseDownloadFiles(stdout: string) {
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, size, modified] = line.split('\t');
        const modifiedSeconds = Number(modified);
        return {
          name: name ?? '',
          path: `${this.downloadDirectory}/${name ?? ''}`,
          sizeBytes: Number(size) || 0,
          modifiedAt:
            Number.isFinite(modifiedSeconds) && modifiedSeconds > 0
              ? new Date(modifiedSeconds * 1000).toISOString()
              : null,
        };
      })
      .filter((file) => file.name.length > 0);
  }

  /**
   * Applies profile overrides before start and removes any incompatible container.
   * Volume names are derived from the normalized profile name.
   */
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
    await this.state.save(app);
  }

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

  /**
   * Marks runtime-only config changes for later recreation or removes a stopped container now.
   */
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

  /**
   * Enforces the recreate-on-start contract before launching again.
   * A running container must be stopped first to avoid mutating it in place.
   */
  private async prepareContainerForRecreationOnStart(app: AndroidApplication) {
    if (!app.recreateContainerOnNextStart) {
      return;
    }

    if (!app.containerId) {
      app.recreateContainerOnNextStart = false;
      await this.state.save(app);
      return;
    }

    const runtimeState = await this.docker.getContainerRuntimeState(
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

  private async removeManagedContainer(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    await this.networkPolicy.remove(app);
    await this.docker.removeContainer(app.containerId);
    app.containerId = null;
  }

  private async prepareViewerNetwork(app: AndroidApplication) {
    try {
      const sidecarTarget = await this.docker.ensureWsScrcpySidecarOnNetwork(
        app.networkName,
      );
      await this.logs.append(app.id, 'ws-scrcpy network prepared', {
        networkName: app.networkName,
        configured: sidecarTarget.configured,
        connected: sidecarTarget.connected,
        message: sidecarTarget.message,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not prepare ws-scrcpy network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'ws-scrcpy network preparation failed', {
        networkName: app.networkName,
        message,
      });
    }
  }

  private async releaseViewerNetwork(app: AndroidApplication) {
    try {
      await this.docker.detachWsScrcpySidecarFromNetwork(app.networkName);
      await this.logs.append(app.id, 'ws-scrcpy network released', {
        networkName: app.networkName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not release ws-scrcpy network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'ws-scrcpy network release failed', {
        networkName: app.networkName,
        message,
      });
    }
  }

  /**
   * Copies APK metadata onto the app after enforcing owner isolation.
   */
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

  /**
   * Guards operations that should not run against removed applications.
   */
  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException(
        'Removed applications cannot be started or updated.',
      );
    }
  }
}
