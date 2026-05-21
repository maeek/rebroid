import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getErrorMessage } from '../../../common/error-message';
import { throwNotFound } from '../../../common/not-found';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { ContainerRuntimeState } from '../../../docker/docker.types';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { shouldReconcileContainerState } from '../utils/android-apps-state.utils';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';
import { AndroidAppsStatusService } from './android-apps-status.service';

@Injectable()
export class AndroidAppsStateService {
  private readonly logger = new Logger(AndroidAppsStateService.name);

  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly status: AndroidAppsStatusService,
  ) {}

  /** Lists apps and refreshes their runtime state. */
  async list(query: ListAndroidApplicationsDto) {
    const apps = await this.applications.find({
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
    return Promise.all(apps.map((app) => this.reconcileContainerState(app)));
  }

  /** Loads one app and refreshes its runtime state. */
  async get(id: string) {
    const app = await this.getStored(id);
    return this.reconcileContainerState(app);
  }

  /** Loads one app without changing its state. */
  async getStored(id: string) {
    return (
      (await this.applications.findOneBy({ id })) ??
      throwNotFound('Application', id)
    );
  }

  /** Fills the extra display fields on an app. */
  decorateApplication(app: AndroidApplication) {
    return this.status.decorateApplication(app);
  }

  /** Saves an app as-is. */
  async save(app: AndroidApplication) {
    return this.applications.save(app);
  }

  /** Saves an app and fills its display fields. */
  async saveAndDecorate(app: AndroidApplication) {
    const saved = await this.applications.save(app);
    return this.status.decorateApplication(saved);
  }

  /** Updates only the lifecycle fields for an app. */
  async setLifecycle(
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

  /** Clears a missing container reference from the app record. */
  async clearMissingContainerReference(app: AndroidApplication) {
    if (!app.containerId) {
      return app;
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (runtimeState.exists) {
      return app;
    }

    await this.networkPolicy.remove(app);
    app.containerId = null;
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage =
      'Managed container was removed. A new container will be created on start.';
    app.lastStoppedAt = new Date();
    await this.applications.save(app);
    return app;
  }

  /** Finds running apps that have been idle too long. */
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

  /** Syncs saved app state with the current container state. */
  private async reconcileContainerState(app: AndroidApplication) {
    if (!shouldReconcileContainerState(app)) {
      return this.status.decorateApplication(app);
    }

    const containerId = app.containerId;
    if (!containerId) {
      return this.status.decorateApplication(app);
    }

    let runtimeState: ContainerRuntimeState;
    try {
      runtimeState = await this.lifecycle.getContainerRuntimeState(containerId);
    } catch (error) {
      this.logger.warn(
        `Could not inspect container state for ${app.id}: ${getErrorMessage(error)}`,
      );
      return this.status.decorateApplication(app);
    }

    if (runtimeState.exists && runtimeState.running) {
      return this.status.decorateApplication(app);
    }

    const message = runtimeState.exists
      ? this.status.containerExitedMessage(app, runtimeState)
      : 'Managed container no longer exists.';

    if (app.status === AndroidApplicationStatus.Provisioning) {
      if (runtimeState.exists && runtimeState.exitCode === 0) {
        app.status = AndroidApplicationStatus.Stopped;
        app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
        app.statusMessage = message;
        app.lastError = null;
        app.lastStoppedAt = runtimeState.finishedAt
          ? new Date(runtimeState.finishedAt)
          : new Date();
        this.tracker.cancel(app.id);
        return this.saveAndDecorate(app);
      }

      if (!runtimeState.exists) {
        await this.networkPolicy.remove(app);
        app.containerId = null;
      }
      app.status = AndroidApplicationStatus.Error;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Error;
      app.statusMessage = message;
      app.lastError = message;
      app.lastStoppedAt = new Date();
      this.tracker.cancel(app.id);
      return this.saveAndDecorate(app);
    }

    if (app.status === AndroidApplicationStatus.Running) {
      if (runtimeState.exists && runtimeState.exitCode === 0) {
        app.status = AndroidApplicationStatus.Stopped;
        app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
        app.statusMessage = this.status.stoppedStatusMessage(app);
        app.lastError = null;
        app.lastStoppedAt = runtimeState.finishedAt
          ? new Date(runtimeState.finishedAt)
          : new Date();
        return this.saveAndDecorate(app);
      }

      if (!runtimeState.exists) {
        await this.networkPolicy.remove(app);
        app.containerId = null;
      }
      app.status = AndroidApplicationStatus.Error;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Error;
      app.statusMessage = message;
      app.lastError = message;
      app.lastStoppedAt = new Date();
      return this.saveAndDecorate(app);
    }

    return this.status.decorateApplication(app);
  }
}
