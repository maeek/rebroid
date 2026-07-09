import {
  Inject,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../../../docker/contracts/docker-resource-runtime.port';
import { getErrorMessage } from '../../../common/error-message';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import {
  forgetSavedProfile,
  rememberSavedProfile,
} from '../../common/utils/android-apps-profile-history.utils';
import {
  applyRedroidDefaultContainerArgs,
  isRedroidRuntime,
} from '@rebroid/application-core/redroid-runtime';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationDto } from '../../common/dto/update-android-application.dto';

@Injectable()
export class AndroidAppsRuntimePreparationService {
  private readonly logger = new Logger(
    AndroidAppsRuntimePreparationService.name,
  );

  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly logs: AndroidAppsLogService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly writer: AndroidAppsStateWriter,
  ) {}

  async switchProfile(
    app: AndroidApplication,
    dto: SwitchApplicationProfileDto,
  ) {
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
  }

  shouldRecreateContainerOnUpdate(
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

  async markContainerForRecreation(app: AndroidApplication) {
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

  async prepareRuntimeProfile(
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
        await this.writer.save(app);
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
    await this.writer.save(app);
  }

  async deleteSavedPersistentProfile(
    app: AndroidApplication,
    profileName: string,
  ) {
    const name = profileName.trim();
    if (!name) {
      throw new NotFoundException('Saved profile not found.');
    }

    const activeProfileName = app.profileName || 'default';
    if (
      app.profileMode === ApplicationProfileMode.Persistent &&
      activeProfileName === name
    ) {
      throw new ConflictException(
        'The active persistent profile cannot be deleted. Switch profiles before deleting it.',
      );
    }

    const result = forgetSavedProfile(app.savedProfilesJson, {
      mode: ApplicationProfileMode.Persistent,
      name,
    });
    if (!result.removed) {
      throw new NotFoundException('Saved profile not found.');
    }

    const volumeName = this.networkIsolation.namesFor(
      app.id,
      app.name,
      name,
    ).volumeName;
    await this.resources.removeVolume(volumeName);
    app.savedProfilesJson = result.savedProfilesJson;
    await this.writer.save(app);
  }

  async prepareContainerForRecreationOnStart(app: AndroidApplication) {
    if (!app.recreateContainerOnNextStart) {
      return;
    }

    if (!app.containerId) {
      app.recreateContainerOnNextStart = false;
      await this.writer.save(app);
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
    await this.writer.save(app);
  }

  async prepareContainerForRuntimeHostConfig(app: AndroidApplication) {
    if (
      !app.containerId ||
      !isRedroidRuntime(app.containerImage, app.runtimeKind)
    ) {
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
      await this.writer.save(app);
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
    await this.writer.save(app);
  }

  async prepareRuntimeDefaults(app: AndroidApplication) {
    const nextContainerArgs = applyRedroidDefaultContainerArgs(
      app.containerImage,
      app.containerArgs,
      app.runtimeKind,
    );
    if (nextContainerArgs === app.containerArgs) {
      return;
    }

    const previousContainerArgs = app.containerArgs;
    app.containerArgs = nextContainerArgs;

    if (!app.containerId) {
      await this.writer.save(app);
      return;
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.running) {
      app.recreateContainerOnNextStart = true;
      app.statusMessage =
        'Runtime boot defaults changed. Stop and start the app to recreate the managed container.';
      await this.writer.save(app);
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
    await this.writer.save(app);
  }

  async recoverStaleProvisioningForStart(app: AndroidApplication) {
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
    await this.writer.save(app);
    return true;
  }

  async prepareFailedContainerForRestart(app: AndroidApplication) {
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
    await this.writer.save(app);
  }

  async removeManagedContainer(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    await this.networkPolicy.remove(app);
    await this.lifecycle.removeContainer(app.containerId);
    app.containerId = null;
  }

  async recoverAfterFailedStop(app: AndroidApplication, error: unknown) {
    if (!app.containerId) {
      return true;
    }

    const message = getErrorMessage(error);
    try {
      const runtimeState = await this.lifecycle.getContainerRuntimeState(
        app.containerId,
      );
      if (!runtimeState.exists) {
        app.containerId = null;
        return true;
      }
      if (!runtimeState.running) {
        return true;
      }

      app.status = AndroidApplicationStatus.Running;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
      app.statusMessage = 'Stop failed. Runtime container is still running.';
      await this.logs.append(app.id, 'Stop failed', { error: message });
      await this.writer.save(app);
      return false;
    } catch (inspectError) {
      this.logger.warn(
        `Could not verify container state after stop failed for ${app.id}: ${getErrorMessage(inspectError)}`,
      );
      return false;
    }
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
}
