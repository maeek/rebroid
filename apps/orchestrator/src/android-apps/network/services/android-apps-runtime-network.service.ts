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
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsRuntimeNetworkService {
  private readonly logger = new Logger(AndroidAppsRuntimeNetworkService.name);

  constructor(
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
  ) {}

  /** Creates the app network boundary. Viewer support attaches lazily when needed. */
  async createRuntimeBoundary(app: AndroidApplication) {
    await this.networkIsolation.createRuntimeBoundary(app.id, app.profileMode, {
      networkName: app.networkName,
      volumeName: app.volumeName,
    });
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
    } = {},
  ) {
    const result = await this.applyPolicyWithRetries(
      app,
      options.retryAttempts ?? 1,
    );
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    if (options.recordLastStartedAt) {
      app.lastStartedAt = new Date();
    }
    await this.state.save(app);

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

  /**
   * Applies fail-closed policy after Docker has started the container and assigned
   * its network address. A persistent enforcement failure stops the runtime.
   */
  async enforcePolicyAfterStart(
    app: AndroidApplication,
    options: {
      log?: boolean;
      recordLastStartedAt?: boolean;
      retryAttempts?: number;
    } = {},
  ) {
    try {
      return await this.reconcilePolicy(app, {
        ...options,
        failClosed: true,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      await this.logs
        .append(app.id, 'Stopping runtime after network policy failure', {
          containerId: app.containerId,
          message,
        })
        .catch(() => undefined);
      if (app.containerId) {
        await this.containers.stopContainer(app.containerId, 10);
      }
      throw error;
    }
  }

  private async applyPolicyWithRetries(
    app: AndroidApplication,
    maxAttempts: number,
  ): Promise<AppliedNetworkPolicy> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.networkPolicy.apply(app);
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
