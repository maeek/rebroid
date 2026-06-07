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
  private readonly networkPreparations = new Map<string, Promise<unknown>>();
  private readonly adbTargetPreparations = new Map<string, Promise<unknown>>();

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
    const applicationId = app?.id;
    if (!applicationId) {
      this.logger.warn(
        'Could not prepare display sidecar network: application id is missing.',
      );
      return;
    }
    if (!app.networkName) {
      this.logger.warn(
        `Could not prepare display sidecar network for ${applicationId}: network name is missing.`,
      );
      return;
    }
    try {
      await this.ensureNetworkPrepared(app);
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not prepare display sidecar network for ${applicationId}: ${message}`,
      );
      await this.appendLifecycleLog(
        applicationId,
        'Display sidecar network preparation failed',
        {
          networkName: app.networkName,
          message,
        },
      );
    }
  }

  /** Coalesces concurrent viewer requests that need the same sidecar attachment. */
  async ensureNetworkPrepared(app: AndroidApplication) {
    return this.coalesce(
      this.networkPreparations,
      app.networkName,
      async () => {
        const sidecarTarget = await this.sidecar.ensureSidecarOnNetwork(
          app.networkName,
        );
        await this.appendLifecycleLog(
          app.id,
          'Display sidecar network prepared',
          {
            networkName: app.networkName,
            configured: sidecarTarget.configured,
            connected: sidecarTarget.connected,
            message: sidecarTarget.message,
          },
        );
        return sidecarTarget;
      },
    );
  }

  /** Removes the viewer sidecar from the app network. */
  async releaseNetwork(app: AndroidApplication) {
    const applicationId = app.id;
    if (!applicationId) {
      this.logger.warn(
        'Could not release display sidecar network: application id is missing.',
      );
      return;
    }
    if (!app.networkName) {
      this.logger.warn(
        `Could not release display sidecar network for ${applicationId}: network name is missing.`,
      );
      return;
    }
    try {
      await this.sidecar.detachSidecarFromNetwork(app.networkName);
      await this.appendLifecycleLog(
        applicationId,
        'Display sidecar network released',
        {
          networkName: app.networkName,
        },
      );
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not release display sidecar network for ${applicationId}: ${message}`,
      );
      await this.appendLifecycleLog(
        applicationId,
        'Display sidecar network release failed',
        {
          networkName: app.networkName,
          message,
        },
      );
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
    return this.coalesce(
      this.adbTargetPreparations,
      `${app.containerId ?? app.containerName}:${adbHost}:${app.adbPort}`,
      () => this.prepareScrcpyAdbTargetOnce(app, adbHost),
    );
  }

  private async prepareScrcpyAdbTargetOnce(
    app: AndroidApplication,
    adbHost: string,
  ) {
    await this.reapplyNetworkPolicy(app);
    await this.ensureRedroidTcpAdb(app);

    await this.appendLifecycleLog(
      app.id,
      'Preparing display sidecar ADB target',
      {
        networkName: app.networkName,
        containerName: app.containerName,
        containerId: app.containerId,
        adbHost,
        adbPort: app.adbPort,
      },
    );

    const result = await this.sidecar.connectAdb(adbHost, app.adbPort);
    await this.appendLifecycleLog(
      app.id,
      'Display sidecar ADB target prepared',
      {
        adbHost,
        adbPort: app.adbPort,
        configured: result.configured,
        connected: result.connected,
        message: result.message,
        error: result.error?.message ?? null,
        errorCode: result.error?.code ?? null,
      },
    );

    return result;
  }

  private coalesce<T>(
    pendingOperations: Map<string, Promise<unknown>>,
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const existing = pendingOperations.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const pending = operation().finally(() => {
      if (pendingOperations.get(key) === pending) {
        pendingOperations.delete(key);
      }
    });
    pendingOperations.set(key, pending);
    return pending;
  }

  /** Reapplies policy before opening viewer access. */
  private async reapplyNetworkPolicy(app: AndroidApplication) {
    const result = await this.networkPolicy.apply(app);
    app.networkPolicyStatus = result.status;
    app.networkPolicyMessage = result.message;
    app.networkPolicyAppliedAt = new Date();
    await this.state.save(app);
    if (app.networkPolicyEnabled && result.status !== 'applied') {
      throw new Error(`Outbound policy enforcement failed: ${result.message}`);
    }
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
      await this.appendLifecycleLog(
        app.id,
        'Redroid TCP ADB ensured for viewer',
        {
          adbPort: app.adbPort,
          message: result.stdout.trim(),
        },
      );
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not ensure Redroid TCP ADB for viewer ${app.id}: ${message}`,
      );
      await this.appendLifecycleLog(
        app.id,
        'Redroid TCP ADB ensure failed for viewer',
        {
          adbPort: app.adbPort,
          message,
        },
      );
    }
  }

  private async appendLifecycleLog(
    applicationId: string | undefined,
    message: string,
    context: unknown,
  ) {
    if (!applicationId) return;
    await this.logs.append(applicationId, message, context);
  }
}
