import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerNetworkRuntimeService } from '../../../docker/networks/services/docker-network-runtime.service';
import { DockerSidecarService } from '../../../docker/sidecar/services/docker-sidecar.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { isRedroidImageName } from '../../provisioning/utils/redroid-runtime.utils';

@Injectable()
export class AndroidAppsViewerNetworkService {
  private readonly logger = new Logger(AndroidAppsViewerNetworkService.name);

  constructor(
    private readonly networks: DockerNetworkRuntimeService,
    private readonly sidecar: DockerSidecarService,
    private readonly exec: DockerContainerExecService,
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
      await this.logs.append(app.id, 'Display sidecar network prepared', {
        networkName: app.networkName,
        configured: sidecarTarget.configured,
        connected: sidecarTarget.connected,
        message: sidecarTarget.message,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not prepare display sidecar network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'Display sidecar network preparation failed', {
        networkName: app.networkName,
        message,
      });
    }
  }

  /** Removes the viewer sidecar from the app network. */
  async releaseNetwork(app: AndroidApplication) {
    try {
      await this.sidecar.detachSidecarFromNetwork(app.networkName);
      await this.logs.append(app.id, 'Display sidecar network released', {
        networkName: app.networkName,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not release display sidecar network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'Display sidecar network release failed', {
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
    await this.ensureRedroidTcpAdb(app);

    await this.logs.append(app.id, 'Preparing display sidecar ADB target', {
      networkName: app.networkName,
      containerName: app.containerName,
      containerId: app.containerId,
      adbHost,
      adbPort: app.adbPort,
    });

    const result = await this.sidecar.connectAdb(adbHost, app.adbPort);
    await this.logs.append(app.id, 'Display sidecar ADB target prepared', {
      adbHost,
      adbPort: app.adbPort,
      configured: result.configured,
      connected: result.connected,
      message: result.message,
      error: result.error?.message ?? null,
      errorCode: result.error?.code ?? null,
    });

    return result;
  }

  /** Reapplies policy before opening viewer access. */
  private async reapplyNetworkPolicy(app: AndroidApplication) {
    const result = await this.networkPolicy.apply(app);
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    await this.state.save(app);
  }

  /** Recovered Redroid containers may be running before provisioning enabled TCP ADB. */
  private async ensureRedroidTcpAdb(app: AndroidApplication) {
    if (!app.containerId || !isRedroidImageName(app.containerImage)) {
      return;
    }

    try {
      const result = await this.exec.execInContainerWithOutput(
        app.containerId,
        [
          'sh',
          '-lc',
          [
            'set -e',
            `port=${app.adbPort}`,
            'persist_port="$(getprop persist.adb.tcp.port 2>/dev/null || true)"',
            'service_port="$(getprop service.adb.tcp.port 2>/dev/null || true)"',
            'adbd_state="$(getprop init.svc.adbd 2>/dev/null || true)"',
            'if { [ "$persist_port" = "$port" ] || [ "$service_port" = "$port" ]; } && [ "$adbd_state" = "running" ]; then',
            '  echo "Redroid TCP ADB already enabled."',
            '  exit 0',
            'fi',
            'setprop persist.adb.tcp.port "$port"',
            'setprop service.adb.tcp.port "$port"',
            '[ "$adbd_state" != "running" ] || stop adbd',
            'start adbd',
            'echo "Redroid TCP ADB enabled and adbd restarted."',
          ].join('\n'),
        ],
        { timeoutMs: 10_000 },
      );
      await this.logs.append(app.id, 'Redroid TCP ADB ensured for viewer', {
        adbPort: app.adbPort,
        message: result.stdout.trim(),
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not ensure Redroid TCP ADB for viewer ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'Redroid TCP ADB ensure failed for viewer', {
        adbPort: app.adbPort,
        message,
      });
    }
  }
}
