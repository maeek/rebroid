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
import { ApplicationProfileStorage } from '../policies/application-profile-storage';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { rememberSavedProfile } from '../../common/utils/android-apps-profile-history.utils';
import {
  applyRedroidDefaultContainerArgs,
  isRedroidRuntime,
  stripManagedRedroidGpuArgs,
} from '@rebroid/android-application-core/redroid-runtime';
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
    private readonly writer: AndroidAppsStateWriter,
  ) {}

  async switchProfile(
    app: AndroidApplication,
    dto: SwitchApplicationProfileDto,
  ) {
    const profile = await this.selectProfile(app, dto);
    await this.removeManagedContainer(app);

    app.profileMode = profile.mode;
    app.profileName = profile.name;
    app.volumeName = profile.volumeName;
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
    const currentArgs = isRedroidRuntime(app.containerImage, app.runtimeKind)
      ? stripManagedRedroidGpuArgs(app.containerArgs)
      : app.containerArgs;
    return (
      (dto.memoryLimitMb !== undefined &&
        dto.memoryLimitMb !== app.memoryLimitMb) ||
      (dto.cpuLimitCpus !== undefined &&
        dto.cpuLimitCpus !== app.cpuLimitCpus) ||
      (dto.containerArgs !== undefined &&
        (dto.containerArgs?.trim() || null) !== currentArgs)
    );
  }

  async prepareRuntimeProfile(
    app: AndroidApplication,
    dto: StartAndroidApplicationDto,
  ) {
    const requested =
      dto.profileMode !== undefined || dto.profileName !== undefined;
    const profile = requested ? await this.selectProfile(app, dto) : null;
    const historyEntry =
      profile ??
      new ApplicationProfileStorage(
        app,
        this.networkIsolation,
      ).unrecordedCurrentProfile();
    if (!historyEntry) return;
    const nextSavedProfilesJson = rememberSavedProfile(
      app.savedProfilesJson,
      historyEntry,
    );

    if (
      !profile ||
      (profile.mode === app.profileMode &&
        profile.name === app.profileName &&
        profile.volumeName === app.volumeName)
    ) {
      if (nextSavedProfilesJson !== app.savedProfilesJson) {
        app.savedProfilesJson = nextSavedProfilesJson;
        await this.writer.saveFields(app, 'savedProfilesJson');
      }
      return;
    }

    await this.removeManagedContainer(app);

    app.profileMode = profile.mode;
    app.profileName = profile.name;
    app.savedProfilesJson = nextSavedProfilesJson;
    app.volumeName = profile.volumeName;
    await this.writer.saveFields(
      app,
      'profileMode',
      'profileName',
      'volumeName',
      'containerId',
      'savedProfilesJson',
    );
  }

  async deleteSavedPersistentProfile(
    app: AndroidApplication,
    profileName: string,
  ) {
    const plan = new ApplicationProfileStorage(
      app,
      this.networkIsolation,
    ).planRemoval(profileName);
    if (plan === 'missing')
      throw new NotFoundException('Saved profile not found.');
    if (plan === 'active') {
      throw new ConflictException(
        'The active persistent profile cannot be deleted. Switch profiles before deleting it.',
      );
    }
    if (plan === 'shared') {
      throw new ConflictException(
        'This profile shares storage with another persistent profile. Its volume must be preserved.',
      );
    }
    await this.resources.removeVolume(plan.volumeName);
    app.savedProfilesJson = plan.savedProfilesJson;
    await this.writer.saveFields(app, 'savedProfilesJson');
  }

  private async selectProfile(
    app: AndroidApplication,
    request: SwitchApplicationProfileDto | StartAndroidApplicationDto,
  ) {
    const profile = new ApplicationProfileStorage(
      app,
      this.networkIsolation,
    ).select(request);
    if (profile.admission === 'shared') {
      throw new ConflictException(
        'A persistent profile already uses this storage name. Choose a name with a distinct spelling beyond case and punctuation.',
      );
    }
    if (
      profile.admission === 'inspect' &&
      (await this.resources.inspectVolume(profile.volumeName))
    ) {
      throw new ConflictException(
        'A volume already exists for this profile name without a matching saved profile. Choose a different name to preserve the existing data.',
      );
    }
    return profile;
  }

  async prepareContainerForRecreationOnStart(app: AndroidApplication) {
    if (!app.recreateContainerOnNextStart) {
      return;
    }

    if (!app.containerId) {
      app.recreateContainerOnNextStart = false;
      await this.writer.saveFields(app, 'recreateContainerOnNextStart');
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
    await this.writer.saveFields(
      app,
      'containerId',
      'recreateContainerOnNextStart',
    );
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

    if (
      !app.containerId ||
      (isRedroidRuntime(app.containerImage, app.runtimeKind) &&
        nextContainerArgs === stripManagedRedroidGpuArgs(previousContainerArgs))
    ) {
      await this.writer.saveFields(app, 'containerArgs');
      return;
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.running) {
      app.recreateContainerOnNextStart = true;
      app.statusMessage =
        'Runtime boot defaults changed. Stop and start the app to recreate the managed container.';
      await this.writer.saveFields(
        app,
        'containerArgs',
        'recreateContainerOnNextStart',
        'statusMessage',
      );
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
    await this.writer.saveFields(
      app,
      'containerArgs',
      'containerId',
      'recreateContainerOnNextStart',
      'statusMessage',
    );
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
    if (app.containerId) {
      await this.removeManagedContainer(app);
    }
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage =
      'Previous provisioning run was stale. A fresh start will be attempted.';
    app.provisioningCompletedAt = new Date();
    app.lastStoppedAt = new Date();
    await this.writer.saveFields(
      app,
      'containerId',
      'status',
      'lifecycleStage',
      'statusMessage',
      'provisioningCompletedAt',
      'lastStoppedAt',
    );
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
    await this.writer.saveFields(
      app,
      'containerId',
      'status',
      'lifecycleStage',
      'statusMessage',
      'recreateContainerOnNextStart',
    );
  }

  async removeManagedContainer(app: AndroidApplication) {
    if (!app.containerId) {
      return;
    }

    const containerId = app.containerId;
    await this.lifecycle.removeContainer(containerId);
    await this.networkPolicy.remove(app, containerId);
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
      await this.writer.saveFields(
        app,
        'status',
        'lifecycleStage',
        'statusMessage',
      );
      return false;
    } catch (inspectError) {
      this.logger.warn(
        `Could not verify container state after stop failed for ${app.id}: ${getErrorMessage(inspectError)}`,
      );
      return false;
    }
  }
}
