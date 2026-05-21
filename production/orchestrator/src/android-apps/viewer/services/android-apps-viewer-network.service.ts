import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { DockerNetworkRuntimeService } from '../../../docker/networks/services/docker-network-runtime.service';
import { DockerSidecarService } from '../../../docker/sidecar/services/docker-sidecar.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';

@Injectable()
export class AndroidAppsViewerNetworkService {
  private readonly logger = new Logger(AndroidAppsViewerNetworkService.name);

  constructor(
    private readonly networks: DockerNetworkRuntimeService,
    private readonly sidecar: DockerSidecarService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
  ) {}

  /** Makes sure the viewer sidecar is on the app network. */
  async prepareNetwork(app: AndroidApplication) {
    try {
      const sidecarTarget = await this.sidecar.ensureSidecarOnNetwork(
        app.networkName,
      );
      await this.logs.append(app.id, 'ws-scrcpy network prepared', {
        networkName: app.networkName,
        configured: sidecarTarget.configured,
        connected: sidecarTarget.connected,
        message: sidecarTarget.message,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not prepare ws-scrcpy network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'ws-scrcpy network preparation failed', {
        networkName: app.networkName,
        message,
      });
    }
  }

  /** Removes the viewer sidecar from the app network. */
  async releaseNetwork(app: AndroidApplication) {
    try {
      await this.sidecar.detachSidecarFromNetwork(app.networkName);
      await this.logs.append(app.id, 'ws-scrcpy network released', {
        networkName: app.networkName,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not release ws-scrcpy network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'ws-scrcpy network release failed', {
        networkName: app.networkName,
        message,
      });
    }
  }

  /** Finds the best ADB host for the viewer. */
  async resolveScrcpyAdbHost(app: AndroidApplication) {
    if (!app.containerId) {
      return app.containerName;
    }

    return (
      (await this.networks.getContainerIpOnNetwork(
        app.containerId,
        app.networkName,
      )) ?? app.containerName
    );
  }

  /** Prepares the viewer sidecar to reach the app over ADB. */
  async prepareScrcpyAdbTarget(app: AndroidApplication, adbHost: string) {
    await this.reapplyNetworkPolicy(app);

    await this.logs.append(app.id, 'Preparing ws-scrcpy ADB target', {
      networkName: app.networkName,
      containerName: app.containerName,
      containerId: app.containerId,
      adbHost,
      adbPort: app.adbPort,
    });

    return this.sidecar.connectAdb(adbHost, app.adbPort);
  }

  /** Reapplies policy before opening viewer access. */
  private async reapplyNetworkPolicy(app: AndroidApplication) {
    const result = await this.networkPolicy.apply(app);
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    await this.state.save(app);
  }
}
