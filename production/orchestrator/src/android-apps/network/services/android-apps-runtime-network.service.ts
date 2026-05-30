import { Injectable } from '@nestjs/common';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';

@Injectable()
export class AndroidAppsRuntimeNetworkService {
  constructor(
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
    private readonly containers: DockerContainerLifecycleService,
  ) {}

  /** Creates the app network boundary and viewer link. */
  async createRuntimeBoundary(app: AndroidApplication) {
    await this.networkIsolation.createRuntimeBoundary(app.id, app.profileMode, {
      networkName: app.networkName,
      volumeName: app.volumeName,
    });
    await this.viewerNetwork.prepareNetwork(app);
  }

  /** Reattaches shared runtime network support. */
  async attachRuntimeSupport(app: AndroidApplication) {
    await this.networkIsolation.connectOrchestrator(app.networkName);
    await this.viewerNetwork.prepareNetwork(app);
  }

  /** Releases shared runtime network support. */
  async releaseRuntimeSupport(app: AndroidApplication) {
    await this.viewerNetwork.releaseNetwork(app);
  }

  /** Applies and stores the current network policy result. */
  async reconcilePolicy(
    app: AndroidApplication,
    options: {
      log?: boolean;
      recordLastStartedAt?: boolean;
      failClosed?: boolean;
    } = {},
  ) {
    let result;
    try {
      result = await this.networkPolicy.apply(app);
    } catch (error) {
      if (options.failClosed && app.networkPolicyEnabled && app.containerId) {
        await this.containers.stopContainer(app.containerId);
      }
      throw error;
    }
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
      if (app.containerId) {
        await this.containers.stopContainer(app.containerId);
      }
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
}
