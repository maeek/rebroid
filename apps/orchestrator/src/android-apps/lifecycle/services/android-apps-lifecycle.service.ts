import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { ApkCatalogService } from '../../../apk/services/apk-catalog.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { getErrorMessage } from '../../../common/error-message';
import { SettingsService } from '../../../settings/settings.service';
import { AndroidApplication } from '../../android-application.entity';
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
import { stoppedStatusMessage } from '../../common/utils/android-apps-status-message.utils';
import { AndroidAppsProvisioningApkService } from '../../provisioning/services/android-apps-provisioning-apk.service';
import { AndroidAppsProvisioningService } from '../../provisioning/services/android-apps-provisioning.service';
import { applyRedroidDefaultContainerArgs } from '@rebroid/application-core/redroid-runtime';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidApplicationFactory } from './android-application.factory';
import { AndroidAppsApkInstallLifecycleService } from './android-apps-apk-install-lifecycle.service';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import { AndroidAppsRemovalService } from './android-apps-removal.service';
import { AndroidAppsStartLifecycleService } from './android-apps-start-lifecycle.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';

@Injectable()
export class AndroidAppsLifecycleService implements OnModuleInit {
  private readonly logger = new Logger(AndroidAppsLifecycleService.name);

  constructor(
    private readonly applications: AndroidApplicationsRepository,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly settings: SettingsService,
    private readonly apks: ApkCatalogService,
    private readonly provisioning: AndroidAppsProvisioningService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly apkInstallLifecycle: AndroidAppsApkInstallLifecycleService,
    private readonly runtimePreparation: AndroidAppsRuntimePreparationService,
    private readonly applicationFactory: AndroidApplicationFactory,
    private readonly removal: AndroidAppsRemovalService,
    private readonly startLifecycle: AndroidAppsStartLifecycleService,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
  ) {}

  onModuleInit() {
    void this.resumeInterruptedJobs().catch((error) => {
      this.logger.warn(
        `Could not resume interrupted application jobs: ${getErrorMessage(error)}`,
      );
    });
  }

  /** Creates a new app and starts provisioning. */
  async create(dto: CreateAndroidApplicationDto) {
    const [settings, uploadedApk] = await Promise.all([
      this.settings.getSettings(),
      dto.uploadedApkId
        ? this.apks.get(dto.uploadedApkId)
        : Promise.resolve(null),
    ]);

    const app = this.applications.create(
      this.applicationFactory.initialFields(dto, settings),
    );

    await this.state.save(app);

    this.applicationFactory.assignGeneratedNames(app);

    if (uploadedApk) {
      this.applicationFactory.applyUploadedApk(app, uploadedApk);
    }

    await this.state.save(app);
    await this.logs.append(app.id, 'Application record created', {
      name: app.name,
      ownerUserId: app.ownerUserId,
      image: app.containerImage,
      hasApk: Boolean(uploadedApk),
    });
    this.tracker.reset(app.id);

    await this.jobs.enqueue(app.id, AndroidAppLifecycleJobKind.Provision);
    this.scheduleProvisioning(app.id);

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
      containerArgs: source.containerArgs ?? undefined,
      uploadedApkId: uploadedApk?.id,
    });
  }

  /** Updates the editable app settings. */
  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.state.get(id);
    const shouldRecreateContainer =
      this.runtimePreparation.shouldRecreateContainerOnUpdate(app, dto);

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
    if (dto.containerArgs !== undefined) {
      app.containerArgs = applyRedroidDefaultContainerArgs(
        app.containerImage,
        dto.containerArgs,
      );
    }

    if (shouldRecreateContainer) {
      await this.runtimePreparation.markContainerForRecreation(app);
    }

    return this.state.saveAndDecorate(app);
  }

  /** Switches the app to another profile. */
  async switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    await this.runtimePreparation.switchProfile(app, dto);

    return this.state.saveAndDecorate(app);
  }

  /** Starts an app container. */
  async start(id: string, dto: StartAndroidApplicationDto = {}) {
    const app = await this.state.get(id);
    this.assertRunnable(app);

    if (app.status === AndroidApplicationStatus.Provisioning) {
      if (
        !(await this.runtimePreparation.recoverStaleProvisioningForStart(app))
      ) {
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
      await this.runtimePreparation.prepareRuntimeProfile(app, dto);
    }

    await this.runtimePreparation.prepareRuntimeDefaults(app);
    await this.state.clearMissingContainerReference(app);
    await this.runtimePreparation.prepareFailedContainerForRestart(app);
    await this.runtimePreparation.prepareContainerForRuntimeHostConfig(app);
    await this.runtimePreparation.prepareContainerForRecreationOnStart(app);

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

    await this.jobs.enqueue(app.id, AndroidAppLifecycleJobKind.Start);
    this.scheduleStart(app.id);

    return this.state.decorateApplication(app);
  }

  /** Stops an app container. */
  async stop(
    id: string,
    options: { reason?: string; details?: Record<string, unknown> } = {},
  ) {
    const app = await this.state.get(id);
    this.tracker.cancel(id);
    await this.jobs.removeForApplication(id);

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopping;
    app.statusMessage = 'Stopping application container.';
    await this.state.save(app);
    await this.logs.append(app.id, 'Stop requested', {
      containerId: app.containerId,
      reason: options.reason ?? 'user_request',
      ...(options.details ?? {}),
    });

    if (app.containerId) {
      try {
        await this.lifecycle.stopContainer(app.containerId, 0);
      } catch (error) {
        if (
          !(await this.runtimePreparation.recoverAfterFailedStop(app, error))
        ) {
          throw error;
        }
      }
    }

    this.removal.releaseDisplaySessionsInBackground(app.id, 'stopping');

    if (app.recreateContainerOnNextStart && app.containerId) {
      await this.runtimePreparation.removeManagedContainer(app);
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
    this.applicationFactory.applyUploadedApk(app, uploadedApk);
    await this.state.save(app);

    if (app.status === AndroidApplicationStatus.Running) {
      await this.apkInstallLifecycle.begin(
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
    await this.jobs.removeForApplication(id);
    app.status = AndroidApplicationStatus.Removing;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Removing;
    app.statusMessage = 'Removing application container and network resources.';
    app.removeDataOnRemoval = query.removeData ?? true;
    await this.state.save(app);
    await this.logs.append(app.id, 'Remove requested', {
      removeData: query.removeData ?? true,
      containerId: app.containerId,
      networkName: app.networkName,
      volumeName: app.volumeName,
    });

    const removeData = app.removeDataOnRemoval;
    await this.jobs.enqueue(app.id, AndroidAppLifecycleJobKind.Remove, {
      removeData,
    });
    this.scheduleRemoval(app, removeData);

    return {
      id,
      deleted: false,
      cleanupQueued: true,
      removedData: removeData,
    };
  }

  /** Finishes removal outside the request so Docker container locks cannot block the UI. */
  private scheduleRemoval(app: AndroidApplication, removeData: boolean) {
    if (!app?.id) {
      this.logger.warn(
        'Skipping removal background job scheduling because application id is missing.',
      );
      return;
    }

    this.scheduleBackgroundJob(`remove:${app.id}`, () =>
      this.removeInBackground(app, removeData),
    );
  }

  private async removeInBackground(
    app: AndroidApplication,
    removeData: boolean,
  ) {
    const applicationId = app?.id;
    if (!applicationId) {
      this.logger.warn(
        'Skipping removal cleanup because application id is missing.',
      );
      return;
    }

    await this.jobs.markRunning(
      applicationId,
      AndroidAppLifecycleJobKind.Remove,
    );
    const maxAttempts = 12;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.removal.cleanupRemovedApplication(app, removeData);
        await this.applications.remove(app);
        await this.logs.remove(applicationId);
        await this.jobs.removeForApplication(applicationId);
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        this.logger.warn(
          `Removal cleanup attempt ${attempt}/${maxAttempts} failed for ${applicationId}: ${message}`,
        );
        if (attempt === maxAttempts) {
          await this.jobs.markFailed(
            applicationId,
            AndroidAppLifecycleJobKind.Remove,
            message,
          );
          await this.logs
            .append(applicationId, 'Removal cleanup paused', { error: message })
            .catch(() => undefined);
          return;
        }
        await delay(5_000);
      }
    }
  }

  private async resumeInterruptedRemovals() {
    const apps = await this.applications.findByStatus(
      AndroidApplicationStatus.Removing,
    );
    for (const app of apps) {
      this.logger.warn(`Resuming interrupted removal cleanup for ${app.id}.`);
      this.tracker.cancel(app.id);
      this.scheduleRemoval(app, app.removeDataOnRemoval);
    }
  }

  private async resumeInterruptedJobs() {
    const restoredApplicationIds = await this.resumePersistedJobs();
    await this.resumeInterruptedRemovals();
    const apps = await this.applications.findAll();
    for (const app of apps) {
      if (restoredApplicationIds.has(app.id)) {
        continue;
      }

      if (app.status === AndroidApplicationStatus.Provisioning) {
        this.logger.warn(`Resuming interrupted provisioning for ${app.id}.`);
        this.tracker.reset(app.id);
        await this.jobs.enqueue(app.id, AndroidAppLifecycleJobKind.Provision);
        this.scheduleProvisioning(app.id);
        continue;
      }

      if (
        app.status === AndroidApplicationStatus.Running &&
        app.lifecycleStage === AndroidApplicationLifecycleStage.ApkInstalling
      ) {
        this.logger.warn(`Resuming interrupted APK install for ${app.id}.`);
        this.tracker.reset(app.id);
        await this.jobs.enqueue(app.id, AndroidAppLifecycleJobKind.InstallApk, {
          statusMessage:
            'Resuming APK installation after orchestrator restart.',
        });
        this.apkInstallLifecycle.resume(
          app.id,
          'Resuming APK installation after orchestrator restart.',
        );
      }
    }
  }

  private async resumePersistedJobs() {
    const restoredApplicationIds = new Set<string>();
    const pendingJobs = (await this.jobs.listPending()).sort((left, right) => {
      if (left.kind === AndroidAppLifecycleJobKind.Remove) return -1;
      if (right.kind === AndroidAppLifecycleJobKind.Remove) return 1;
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });
    for (const job of pendingJobs) {
      if (restoredApplicationIds.has(job.applicationId)) {
        await this.jobs.complete(job.applicationId, job.kind);
        continue;
      }
      const app = await this.applications.findById(job.applicationId);
      if (!app) {
        await this.jobs.removeForApplication(job.applicationId);
        continue;
      }

      restoredApplicationIds.add(app.id);
      this.logger.warn(
        `Resuming persisted ${job.kind} lifecycle job for ${app.id}.`,
      );
      this.tracker.reset(app.id);
      if (job.kind === AndroidAppLifecycleJobKind.Remove) {
        this.tracker.cancel(app.id);
        this.scheduleRemoval(app, app.removeDataOnRemoval);
        continue;
      }
      if (job.kind === AndroidAppLifecycleJobKind.Provision) {
        this.scheduleProvisioning(app.id);
        continue;
      }
      if (job.kind === AndroidAppLifecycleJobKind.Start) {
        this.scheduleStart(app.id);
        continue;
      }
      if (job.kind === AndroidAppLifecycleJobKind.InstallApk) {
        this.apkInstallLifecycle.resume(
          app.id,
          this.apkInstallLifecycle.statusMessageFromPayload(job.payloadJson),
        );
      }
    }
    return restoredApplicationIds;
  }

  private scheduleProvisioning(applicationId: string) {
    this.scheduleBackgroundJob(`provision:${applicationId}`, () =>
      this.provisioning.provision(applicationId),
    );
  }

  private scheduleStart(applicationId: string) {
    this.scheduleBackgroundJob(`start:${applicationId}`, () =>
      this.startLifecycle.startInBackground(applicationId),
    );
  }

  private scheduleBackgroundJob(key: string, operation: () => Promise<void>) {
    this.backgroundJobs.schedule(key, operation);
  }

  /** Applies profile changes before starting the app. */
  /** Checks if an update needs a fresh container. */
  /** Marks the current container to be recreated later. */
  /** Recreates the container on start when needed. */
  /** Recreates stopped containers when Docker-only host config defaults changed. */
  /** Applies current Redroid boot defaults to older app records before start. */
  /** Lets a new start request take over a provisioning record left by a dead run. */
  /** Removes a failed runtime container so retries do not reuse a wedged Redroid boot. */
  /** Removes the managed container for an app. */
  /**
   * A transport error does not prove the container stayed running. Inspect Docker
   * once so definite failures recover immediately and accepted stops can continue.
   */
  /** Blocks actions on removed apps. */
  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException(
        'Removed applications cannot be started or updated.',
      );
    }
  }
}
