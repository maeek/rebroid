import { Inject, Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AppliedNetworkPolicy } from '../../../network-policy/types/network-policy.types';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsRuntimeNetworkService {
  private readonly logger = new Logger(AndroidAppsRuntimeNetworkService.name);

  constructor(
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly logs: AndroidAppsLogService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
  ) {}

  /** Creates the app network boundary. Viewer support attaches lazily when needed. */
  async createRuntimeBoundary(app: AndroidApplication) {
    await this.networkIsolation.createRuntimeBoundary(
      app.id,
      app.profileMode === ApplicationProfileMode.Persistent,
      {
        networkName: app.networkName,
        volumeName: app.volumeName,
      },
    );
  }

  /** Reattaches control-plane support. Viewer support attaches lazily when needed. */
  async attachRuntimeSupport(app: AndroidApplication) {
    await this.networkIsolation.connectOrchestrator(app.networkName);
  }

  /** Releases viewer network support before deleting the app network. */
  async releaseRuntimeSupport(app: AndroidApplication) {
    if (!app?.id || !app?.networkName) {
      return;
    }

    await this.viewerNetwork.releaseNetwork(app);
  }

  /** Applies and stores the current network policy result. */
  async reconcilePolicy(
    app: AndroidApplication,
    options: {
      log?: boolean;
      recordLastStartedAt?: boolean;
      failClosed?: boolean;
      retryAttempts?: number;
      generation?: number;
    } = {},
  ) {
    const result = await this.applyPolicyWithRetries(
      app,
      options.retryAttempts ?? 1,
      options.generation ?? Date.now(),
    );
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    if (options.recordLastStartedAt) {
      app.lastStartedAt = new Date();
    }
    await this.writer.setNetworkPolicyState(app.id, {
      networkPolicyStatus: app.networkPolicyStatus,
      networkPolicyMessage: app.networkPolicyMessage,
      networkPolicyAppliedAt: app.networkPolicyAppliedAt,
      ...(options.recordLastStartedAt
        ? { lastStartedAt: app.lastStartedAt }
        : {}),
    });

    if (
      options.failClosed &&
      app.networkPolicyEnabled &&
      result.status !== 'applied'
    ) {
      throw new Error(`Outbound policy enforcement failed: ${result.message}`);
    }

    if (options.log) {
      await this.logs.append(app.id, 'Network policy reconciled', {
        status: result.status,
        message: result.message,
      });
    }

    return result;
  }

  async reapplyRunningPolicy(app: AndroidApplication, generation: number) {
    try {
      return await this.reconcilePolicy(app, { failClosed: true, generation });
    } catch (error) {
      await this.stopAfterPolicyFailure(app, error);
      throw error;
    }
  }

  /** Block forwarding until the container has an address and its policy is active. */
  async startWithPolicy(
    app: AndroidApplication,
    start: () => Promise<void>,
    options: {
      log?: boolean;
      recordLastStartedAt?: boolean;
      retryAttempts?: number;
    } = {},
  ) {
    let guard: string | undefined;
    try {
      if (app.networkPolicyEnabled) {
        guard = await this.networkPolicy.guardStartup(app);
      }
      await start();
      const result = await this.reconcilePolicy(app, {
        ...options,
        failClosed: true,
      });
      if (guard) await this.networkPolicy.releaseStartupGuard(app.id, guard);
      return result;
    } catch (error) {
      await this.stopAfterPolicyFailure(app, error);
      if (guard) {
        await this.networkPolicy
          .releaseStartupGuard(app.id, guard)
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async stopAfterPolicyFailure(
    app: AndroidApplication,
    error: unknown,
  ) {
    await this.logs
      .append(app.id, 'Stopping runtime after network policy failure', {
        containerId: app.containerId,
        message: getErrorMessage(error),
      })
      .catch(() => undefined);
    if (app.containerId) {
      await this.containers.stopContainer(app.containerId, 10);
    }
  }

  private async applyPolicyWithRetries(
    app: AndroidApplication,
    maxAttempts: number,
    generation: number,
  ): Promise<AppliedNetworkPolicy> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.networkPolicy.apply(app, generation);
        if (
          !app.networkPolicyEnabled ||
          result.status === 'applied' ||
          attempt === maxAttempts
        ) {
          return result;
        }

        this.logger.warn(
          `Network policy for ${app.id} is not ready. Retrying ${attempt}/${maxAttempts - 1}: ${result.message}`,
        );
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        this.logger.warn(
          `Network policy preparation for ${app.id} failed. Retrying ${attempt}/${maxAttempts - 1}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await delay(500);
    }

    throw new Error('Network policy preparation failed.');
  }
}
