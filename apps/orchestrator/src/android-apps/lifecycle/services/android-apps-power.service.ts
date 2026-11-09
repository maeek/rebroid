import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { stoppedStatusMessage } from '../../common/utils/android-apps-status-message.utils';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsProvisioningApkService } from '../../provisioning/services/android-apps-provisioning-apk.service';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppsRemovalService } from './android-apps-removal.service';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import { AndroidAppsStartLifecycleService } from './android-apps-start-lifecycle.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';

type StopOptions = { reason?: string; details?: Record<string, unknown> };

@Injectable()
export class AndroidAppsPowerService {
  constructor(
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
    private readonly logs: AndroidAppsLogService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly removal: AndroidAppsRemovalService,
    private readonly runtimePreparation: AndroidAppsRuntimePreparationService,
    private readonly startLifecycle: AndroidAppsStartLifecycleService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly features: FeatureFlagsService,
  ) {}

  async start(
    id: string,
    dto: StartAndroidApplicationDto = {},
    maxOpenApps?: number,
  ) {
    const { application: app, outcome } =
      await this.reconciler.reconcileResultById(id);
    if (outcome === 'unavailable') {
      throw new ServiceUnavailableException(
        'Could not verify the current app container with Docker. Check the Docker connection and try again.',
      );
    }
    this.assertRunnable(app);
    if (app.networkPolicyEnabled) {
      this.features.assertEnabled('feature.firewall');
    }

    if (app.status === AndroidApplicationStatus.Provisioning) {
      if (await this.transitions.hasRecreateJob(id)) {
        return this.queries.decorate(app);
      }
      const recovered =
        await this.runtimePreparation.recoverStaleProvisioningForStart(app);
      if (!recovered) return this.queries.decorate(app);
    }
    if (app.status === AndroidApplicationStatus.Running) {
      if (app.apkFilePath) await this.apkProvisioning.launchInstalledApk(app);
      return this.queries.decorate(app);
    }
    if (
      app.status === AndroidApplicationStatus.Removing ||
      app.lifecycleStage === AndroidApplicationLifecycleStage.Stopping
    ) {
      throw new ConflictException(
        'Wait for the current stop or removal to finish before starting the app.',
      );
    }

    if (dto.profileMode !== undefined || dto.profileName !== undefined) {
      await this.runtimePreparation.prepareRuntimeProfile(app, dto);
    }
    await this.runtimePreparation.prepareRuntimeDefaults(app);
    await this.runtimePreparation.prepareFailedContainerForRestart(app);
    await this.runtimePreparation.prepareContainerForRuntimeHostConfig(app);
    await this.runtimePreparation.prepareContainerForRecreationOnStart(app);

    const patch = {
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
      statusMessage: 'Starting application container.',
      lastError: null,
      provisioningStartedAt: new Date(),
      provisioningCompletedAt: null,
    };
    await this.transitions.beginJob(
      id,
      AndroidAppLifecycleJobKind.Start,
      patch,
      undefined,
      true,
      maxOpenApps,
    );
    this.tracker.reset(id);
    Object.assign(app, patch);
    await this.logs.append(id, 'Start requested', {
      profileMode: app.profileMode,
      profileName: app.profileName,
      existingContainerId: app.containerId,
      image: app.containerImage,
    });
    this.backgroundJobs.schedule(`start:${id}`, () =>
      this.startLifecycle.startInBackground(id),
    );
    return this.queries.decorate(app);
  }

  async recreate(id: string, maxOpenApps?: number) {
    const app = await this.reconciler.reconcileById(id);
    if (app.networkPolicyEnabled) {
      this.features.assertEnabled('feature.firewall');
    }

    await this.transitions.beginJob(
      id,
      AndroidAppLifecycleJobKind.Recreate,
      {
        status: AndroidApplicationStatus.Provisioning,
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Recreating the application container and network.',
        lastError: null,
        provisioningStartedAt: new Date(),
        provisioningCompletedAt: null,
      },
      undefined,
      true,
      maxOpenApps,
    );
    this.tracker.reset(id);
    this.backgroundJobs.schedule(`recreate:${id}`, () =>
      this.startLifecycle.startInBackground(
        id,
        AndroidAppLifecycleJobKind.Recreate,
      ),
    );
    return this.queries.getStored(id);
  }

  async stop(id: string, options: StopOptions = {}) {
    const app = await this.reconciler.reconcileById(id);
    const stoppingPatch = {
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopping,
      statusMessage: 'Stopping application container.',
    };
    await this.transitions.cancelActiveJob(id, stoppingPatch);
    this.tracker.cancel(id);
    Object.assign(app, stoppingPatch);
    await this.logs.append(id, 'Stop requested', {
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
    this.removal.releaseDisplaySessionsInBackground(id, 'stopping');
    if (app.recreateContainerOnNextStart && app.containerId) {
      await this.runtimePreparation.removeManagedContainer(app);
      app.recreateContainerOnNextStart = false;
    }

    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = stoppedStatusMessage(app);
    app.lastStoppedAt = new Date();
    await this.logs.append(id, 'Application stopped', {
      containerId: app.containerId,
      recreateContainerOnNextStart: app.recreateContainerOnNextStart,
    });
    return this.writer.saveAndDecorate(app);
  }

  private assertRunnable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException('Removed applications cannot be started.');
    }
  }
}
