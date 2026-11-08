import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pLimit from 'p-limit';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import { ContainerRuntimeState } from '../../../docker/docker.types';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { shouldReconcileContainerState } from '../utils/android-apps-state.utils';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from './android-apps-query.service';
import { AndroidAppsStateWriter } from './android-apps-state-writer.service';
import { AndroidAppsStatusService } from './android-apps-status.service';

const MAX_RECONCILIATION_CONCURRENCY = 4;

export type AndroidAppRuntimeReconciliationOutcome =
  | 'updated'
  | 'unchanged'
  | 'unavailable';

export type AndroidAppRuntimeReconciliationResult = {
  application: AndroidApplication;
  outcome: AndroidAppRuntimeReconciliationOutcome;
  message?: string;
};

@Injectable()
export class AndroidAppsRuntimeStateReconciler {
  private readonly logger = new Logger(AndroidAppsRuntimeStateReconciler.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly status: AndroidAppsStatusService,
    private readonly queries: AndroidAppsQueryService,
    private readonly writer: AndroidAppsStateWriter,
  ) {}

  async reconcileById(id: string) {
    return this.reconcileOne(await this.queries.getStored(id));
  }

  async reconcileResultById(id: string) {
    return this.reconcileOneWithResult(await this.queries.getStored(id));
  }

  async reconcileMany(query: ListAndroidApplicationsDto) {
    const apps = await this.queries.listStoredEntities(query);
    const limit = pLimit(MAX_RECONCILIATION_CONCURRENCY);
    return Promise.all(apps.map((app) => limit(() => this.reconcileOne(app))));
  }

  async reconcileManyWithResults(query: ListAndroidApplicationsDto) {
    const apps = await this.queries.listStoredEntities(query);
    const limit = pLimit(MAX_RECONCILIATION_CONCURRENCY);
    return Promise.all(
      apps.map((app) => limit(() => this.reconcileOneWithResult(app))),
    );
  }

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
    await this.writer.save(app);
    return app;
  }

  async reconcileOne(app: AndroidApplication) {
    return (await this.reconcileOneWithResult(app)).application;
  }

  async reconcileOneWithResult(
    app: AndroidApplication,
  ): Promise<AndroidAppRuntimeReconciliationResult> {
    if (!shouldReconcileContainerState(app) || !app.containerId) {
      return {
        application: this.status.decorateApplication(app),
        outcome: 'unchanged',
      };
    }

    let runtimeState: ContainerRuntimeState;
    try {
      runtimeState = await this.lifecycle.getContainerRuntimeState(
        app.containerId,
      );
    } catch (error) {
      const message = `Could not inspect container state: ${getErrorMessage(error)}`;
      this.logger.warn(`${message} (${app.id})`);
      return {
        application: this.status.decorateApplication(app),
        outcome: 'unavailable',
        message,
      };
    }

    const before = this.reconciliationFingerprint(app);
    const application = await this.reconcileRuntimeState(app, runtimeState);
    const outcome =
      before === this.reconciliationFingerprint(application)
        ? 'unchanged'
        : 'updated';
    return { application, outcome };
  }

  private reconcileRuntimeState(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    if (
      app.lifecycleStage === AndroidApplicationLifecycleStage.Stopping &&
      this.isStoppingStateStale(app)
    ) {
      return this.recoverStaleStoppingState(app, runtimeState);
    }

    if (runtimeState.exists && runtimeState.running) {
      return this.reconcileRunningContainer(app);
    }

    if (
      app.status === AndroidApplicationStatus.Provisioning &&
      this.isContainerStartOwnedByProvisioning(app)
    ) {
      return this.status.decorateApplication(app);
    }

    return this.reconcileStoppedContainer(app, runtimeState);
  }

  private reconcileRunningContainer(app: AndroidApplication) {
    if (
      app.status !== AndroidApplicationStatus.Stopped &&
      app.status !== AndroidApplicationStatus.Error
    ) {
      return this.status.decorateApplication(app);
    }

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage =
      'Runtime container is running. State recovered from Docker.';
    app.lastError = null;
    app.lastStartedAt = app.lastStartedAt ?? new Date();
    return this.writer.saveAndDecorate(app);
  }

  private async reconcileStoppedContainer(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    const message = runtimeState.exists
      ? this.status.containerExitedMessage(app, runtimeState)
      : 'Managed container no longer exists.';
    if (
      app.status === AndroidApplicationStatus.Provisioning ||
      app.status === AndroidApplicationStatus.Running
    ) {
      this.logger.warn(
        `Managed container stopped for ${app.id}: ${JSON.stringify(runtimeState)}`,
      );
    }

    if (app.status === AndroidApplicationStatus.Provisioning) {
      return this.reconcileStoppedProvisioning(app, runtimeState, message);
    }
    if (app.status === AndroidApplicationStatus.Running) {
      return this.reconcileStoppedRunningApp(app, runtimeState, message);
    }
    return this.status.decorateApplication(app);
  }

  private async reconcileStoppedProvisioning(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
    message: string,
  ) {
    if (runtimeState.exists && runtimeState.exitCode === 0) {
      this.markStopped(app, runtimeState, message);
      this.tracker.cancel(app.id);
      return this.writer.saveAndDecorate(app);
    }

    await this.markRuntimeError(app, runtimeState, message);
    this.tracker.cancel(app.id);
    return this.writer.saveAndDecorate(app);
  }

  private async reconcileStoppedRunningApp(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
    message: string,
  ) {
    if (runtimeState.exists && runtimeState.exitCode === 0) {
      this.markStopped(
        app,
        runtimeState,
        this.status.stoppedStatusMessage(app),
      );
      return this.writer.saveAndDecorate(app);
    }

    await this.markRuntimeError(app, runtimeState, message);
    return this.writer.saveAndDecorate(app);
  }

  private markStopped(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
    message: string,
  ) {
    app.status = AndroidApplicationStatus.Stopped;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
    app.statusMessage = message;
    app.lastError = null;
    app.lastStoppedAt = runtimeState.finishedAt
      ? new Date(runtimeState.finishedAt)
      : new Date();
  }

  private async markRuntimeError(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
    message: string,
  ) {
    if (!runtimeState.exists) {
      await this.networkPolicy.remove(app);
      app.containerId = null;
    }
    app.status = AndroidApplicationStatus.Error;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Error;
    app.statusMessage = message;
    app.lastError = message;
    app.lastStoppedAt = new Date();
  }

  private async recoverStaleStoppingState(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    this.logger.warn(
      `Recovering stale stopping state for ${app.id} from Docker runtime state.`,
    );

    if (runtimeState.exists && runtimeState.running) {
      app.status = AndroidApplicationStatus.Running;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
      app.statusMessage =
        'Stop did not complete. Runtime container is still running.';
      app.lastError = null;
      return this.writer.saveAndDecorate(app);
    }

    if (!runtimeState.exists) {
      await this.networkPolicy.remove(app);
      app.containerId = null;
    }
    this.markStopped(app, runtimeState, this.status.stoppedStatusMessage(app));
    return this.writer.saveAndDecorate(app);
  }

  private isStoppingStateStale(app: AndroidApplication) {
    const timeoutMs =
      this.config.getOrThrow<number>('app.docker.stoppingStaleTimeoutSeconds') *
      1000;
    return Date.now() - app.updatedAt.getTime() >= timeoutMs;
  }

  private isContainerStartOwnedByProvisioning(app: AndroidApplication) {
    return [
      AndroidApplicationLifecycleStage.Queued,
      AndroidApplicationLifecycleStage.ImageChecking,
      AndroidApplicationLifecycleStage.ImagePulling,
      AndroidApplicationLifecycleStage.VolumeCreating,
      AndroidApplicationLifecycleStage.NetworkCreating,
      AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting,
      AndroidApplicationLifecycleStage.ContainerCreating,
      AndroidApplicationLifecycleStage.ContainerStarting,
    ].includes(app.lifecycleStage);
  }

  private reconciliationFingerprint(app: AndroidApplication) {
    return JSON.stringify({
      containerId: app.containerId,
      status: app.status,
      lifecycleStage: app.lifecycleStage,
      statusMessage: app.statusMessage,
      lastError: app.lastError,
      lastStartedAt: app.lastStartedAt?.toISOString() ?? null,
      lastStoppedAt: app.lastStoppedAt?.toISOString() ?? null,
    });
  }
}
