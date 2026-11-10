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
  'updated' | 'unchanged' | 'unavailable';

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
    private readonly status: AndroidAppsStatusService,
    private readonly queries: AndroidAppsQueryService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
  ) {}

  async reconcileById(id: string) {
    return this.reconcileOne(await this.queries.getStored(id));
  }

  async reconcileBeforeStop(id: string) {
    const app = await this.queries.getStored(id);
    const result = await this.reconcileOneWithResult(app, { afterDrain: true });
    return result.application;
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

  async reconcileOne(app: AndroidApplication) {
    return (await this.reconcileOneWithResult(app)).application;
  }

  async reconcileOneWithResult(
    app: AndroidApplication,
    { afterDrain = false } = {},
  ): Promise<AndroidAppRuntimeReconciliationResult> {
    if (!afterDrain && this.tracker.isCancelled(app.id)) {
      return {
        application: this.status.decorateApplication(app),
        outcome: 'unchanged',
      };
    }
    const previous = { ...app };
    if (
      !app.containerId &&
      (app.status === AndroidApplicationStatus.Running ||
        (app.lifecycleStage === AndroidApplicationLifecycleStage.Stopping &&
          this.isStoppingStateStale(app)))
    ) {
      this.clearMissingRuntime(app);
      return this.persistReconciledRuntime(previous, app, afterDrain);
    }
    if (
      !app.containerId ||
      (!afterDrain && !shouldReconcileContainerState(app))
    ) {
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

    this.reconcileRuntimeState(app, runtimeState);
    return this.persistReconciledRuntime(previous, app, afterDrain);
  }

  private async persistReconciledRuntime(
    previous: AndroidApplication,
    app: AndroidApplication,
    afterDrain: boolean,
  ): Promise<AndroidAppRuntimeReconciliationResult> {
    if (
      this.reconciliationFingerprint(previous) ===
      this.reconciliationFingerprint(app)
    ) {
      return {
        application: this.status.decorateApplication(app),
        outcome: 'unchanged',
      };
    }
    if (
      (!afterDrain && this.tracker.isCancelled(app.id)) ||
      !(await this.writer.saveReconciledRuntime(previous, app))
    ) {
      return {
        application: await this.queries.getStored(app.id),
        outcome: 'unchanged',
      };
    }
    if (previous.containerId && !app.containerId) {
      await this.networkPolicy.remove(app, previous.containerId);
    }
    return {
      application: this.status.decorateApplication(app),
      outcome: 'updated',
    };
  }

  private reconcileRuntimeState(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    if (app.lifecycleStage === AndroidApplicationLifecycleStage.Stopping) {
      if (this.isStoppingStateStale(app)) {
        this.recoverStaleStoppingState(app, runtimeState);
      }
      return;
    }

    if (runtimeState.exists && runtimeState.running) {
      return this.reconcileRunningContainer(app);
    }

    if (!runtimeState.exists) {
      return this.clearMissingRuntime(app);
    }
    return this.reconcileStoppedContainer(app, runtimeState);
  }

  private clearMissingRuntime(app: AndroidApplication) {
    app.containerId = null;
    if (app.status !== AndroidApplicationStatus.Error) {
      app.status = AndroidApplicationStatus.Stopped;
      app.lifecycleStage = AndroidApplicationLifecycleStage.Stopped;
      app.statusMessage =
        'Managed container was removed. A new container will be created on start.';
      app.lastError = null;
      app.lastStoppedAt = new Date();
    }
  }

  private reconcileRunningContainer(app: AndroidApplication) {
    if (
      app.status !== AndroidApplicationStatus.Stopped &&
      app.status !== AndroidApplicationStatus.Error
    ) {
      return;
    }

    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.statusMessage =
      'Runtime container is running. State recovered from Docker.';
    app.lastError = null;
    app.lastStartedAt = app.lastStartedAt ?? new Date();
  }

  private reconcileStoppedContainer(
    app: AndroidApplication,
    runtimeState: ContainerRuntimeState,
  ) {
    if (app.status !== AndroidApplicationStatus.Running) {
      return;
    }
    this.logger.warn(
      `Managed container stopped for ${app.id}: ${JSON.stringify(runtimeState)}`,
    );
    if (runtimeState.exitCode === 0) {
      this.markStopped(
        app,
        runtimeState,
        this.status.stoppedStatusMessage(app),
      );
      return;
    }

    this.markRuntimeError(
      app,
      this.status.containerExitedMessage(app, runtimeState),
    );
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

  private markRuntimeError(app: AndroidApplication, message: string) {
    app.status = AndroidApplicationStatus.Error;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Error;
    app.statusMessage = message;
    app.lastError = message;
    app.lastStoppedAt = new Date();
  }

  private recoverStaleStoppingState(
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
      return;
    }

    if (!runtimeState.exists) {
      app.containerId = null;
    }
    this.markStopped(app, runtimeState, this.status.stoppedStatusMessage(app));
  }

  private isStoppingStateStale(app: AndroidApplication) {
    const timeoutMs =
      this.config.getOrThrow<number>('app.docker.stoppingStaleTimeoutSeconds') *
      1000;
    return Date.now() - app.updatedAt.getTime() >= timeoutMs;
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
