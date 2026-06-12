import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { DockerEngineService } from '../../../docker/docker-engine.service';
import { DockerSidecarService } from '../../../docker/sidecar/services/docker-sidecar.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
import { isRedroidImageName } from '@rebroid/application-core/redroid-runtime';
import {
  androidBootDiagnosticSummary,
  androidBootProbeProperties,
  parseAndroidBootReadiness,
  truncateDiagnosticText,
} from '../utils/android-apps-android-provisioning.utils';

@Injectable()
export class AndroidAppsProvisioningAndroidService {
  private readonly logger = new Logger(
    AndroidAppsProvisioningAndroidService.name,
  );

  constructor(
    private readonly exec: DockerContainerExecService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly engine: DockerEngineService,
    private readonly sidecar: DockerSidecarService,
    private readonly logs: AndroidAppsLogService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
    private readonly config: ConfigService,
  ) {}

  /** Waits until Android reports that boot is done. */
  async waitForAndroidBoot(app: AndroidApplication) {
    this.assertContainerId(app);

    const timeoutMs =
      this.config.getOrThrow<number>('app.redroid.bootTimeoutSeconds') * 1000;
    const intervalMs = 1_000;
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'Android boot readiness was not reported.';

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);
      const [probeResult, runtimeStateResult] = await Promise.allSettled([
        this.exec.execInContainerWithOutput(
          app.containerId,
          [
            'sh',
            '-lc',
            androidBootProbeProperties
              .map(
                (prop) =>
                  `printf '${prop}='; getprop ${prop} 2>/dev/null || true; printf '\\n'`,
              )
              .join('; '),
          ],
          { timeoutMs: 10_000 },
        ),
        this.lifecycle.getContainerRuntimeState(app.containerId),
      ]);
      if (runtimeStateResult.status === 'rejected') {
        throw runtimeStateResult.reason;
      }
      if (
        !runtimeStateResult.value.exists ||
        !runtimeStateResult.value.running
      ) {
        throw new Error(
          this.androidBootExitedMessage(runtimeStateResult.value),
        );
      }

      if (probeResult.status === 'fulfilled') {
        const { stdout, stderr } = probeResult.value;
        const readiness = parseAndroidBootReadiness(stdout);
        lastProbe = [readiness.probe, stderr.trim()].filter(Boolean).join(' ');

        if (readiness.ready) {
          await this.logs.append(app.id, 'Android boot completed', {
            probe: lastProbe,
          });
          return;
        }
      } else {
        lastProbe = getErrorMessage(probeResult.reason);
      }

      await delay(intervalMs);
    }

    const diagnostics = await this.collectBootDiagnostics(app);
    await this.logs.append(app.id, 'Android boot diagnostics', diagnostics);

    throw new Error(
      [
        `Timed out waiting for Android to finish booting after ${timeoutMs / 1000}s.`,
        `Last probe: ${lastProbe}`,
        diagnostics.summary ? `Diagnostics: ${diagnostics.summary}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  /** Checks if this image needs ADB port setup. */
  shouldPrepareRemoteAccess(app: AndroidApplication) {
    return isRedroidImageName(app.containerImage);
  }

  /** Turns on remote ADB access for redroid. */
  async prepareRemoteAccess(app: AndroidApplication) {
    this.assertContainerId(app);

    await this.retryTransientRemoteAccessSetup(app.containerId, [
      'sh',
      '-lc',
      [
        `port=${app.adbPort}`,
        'persist_port="$(getprop persist.adb.tcp.port 2>/dev/null || true)"',
        'service_port="$(getprop service.adb.tcp.port 2>/dev/null || true)"',
        'adbd_state="$(getprop init.svc.adbd 2>/dev/null || true)"',
        'if { [ "$persist_port" = "$port" ] || [ "$service_port" = "$port" ]; } && [ "$adbd_state" = "running" ]; then exit 0; fi',
        `setprop persist.adb.tcp.port ${app.adbPort}`,
        `setprop service.adb.tcp.port ${app.adbPort}`,
        '[ "$adbd_state" != "running" ] || stop adbd',
        'start adbd',
      ].join(' && '),
    ]);
    await this.waitForRedroidAdbFromSidecar(app);
    await this.logs.append(app.id, 'Prepared Android remote access', {
      adbPort: app.adbPort,
    });
  }

  /** Waits until the sidecar can reach ADB. */
  private async waitForRedroidAdbFromSidecar(app: AndroidApplication) {
    this.assertContainerId(app);

    const timeoutMs =
      this.config.getOrThrow<number>('app.redroid.adbTimeoutSeconds') * 1000;
    const intervalMs = 1_000;
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'ADB sidecar readiness was not reported.';

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);
      let runtimeState;
      let sidecarTarget;
      let adbHost;
      try {
        [runtimeState, sidecarTarget, adbHost] = await Promise.all([
          this.lifecycle.getContainerRuntimeState(app.containerId),
          this.sidecar.ensureSidecarOnNetwork(app.networkName),
          this.viewerNetwork.resolveScrcpyAdbHost(app),
        ]);
      } catch (error) {
        if (!this.engine.isTransientDockerTransportError(error)) {
          throw error;
        }

        lastProbe = getErrorMessage(error);
        this.logger.warn(
          `Redroid ADB sidecar readiness for ${app.id} hit a transient Docker transport error: ${lastProbe}`,
        );
        await delay(intervalMs);
        continue;
      }

      if (!runtimeState.exists || !runtimeState.running) {
        throw new Error(this.androidBootExitedMessage(runtimeState));
      }

      if (!sidecarTarget.configured || !sidecarTarget.connected) {
        lastProbe =
          sidecarTarget.message ??
          sidecarTarget.error?.message ??
          'Display sidecar is not attached to the app network.';
        await delay(intervalMs);
        continue;
      }

      const adbTarget = await this.sidecar.connectAdb(adbHost, app.adbPort);
      lastProbe =
        adbTarget.message ??
        adbTarget.error?.message ??
        `No ADB response from ${adbHost}:${app.adbPort}.`;

      await this.logs.append(app.id, 'Redroid ADB sidecar probe', {
        networkName: app.networkName,
        adbHost,
        adbPort: app.adbPort,
        configured: adbTarget.configured,
        connected: adbTarget.connected,
        message: adbTarget.message,
        error: adbTarget.error?.message ?? null,
      });

      if (adbTarget.configured && adbTarget.connected) {
        return;
      }

      await delay(intervalMs);
    }

    throw new Error(
      `Timed out waiting for redroid ADB from display sidecar after ${timeoutMs / 1000}s. Last probe: ${lastProbe}`,
    );
  }

  private async retryTransientRemoteAccessSetup(
    containerId: string,
    command: string[],
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.exec.execInContainer(containerId, command);
        return;
      } catch (error) {
        if (
          attempt === maxAttempts ||
          !this.engine.isTransientDockerTransportError(error)
        ) {
          throw error;
        }

        this.logger.warn(
          `Redroid remote ADB setup hit a transient Docker transport error. Retrying ${attempt}/${maxAttempts - 1}: ${getErrorMessage(error)}`,
        );
        await delay(500 * attempt);
      }
    }
  }

  /** Makes sure the app has a container id first. */
  private assertContainerId(
    app: AndroidApplication,
  ): asserts app is AndroidApplication & {
    containerId: string;
  } {
    if (!app.containerId) {
      throw new InternalServerErrorException('Container is required.');
    }
  }

  /** Builds the boot error message for a stopped container. */
  private androidBootExitedMessage(
    runtimeState: Awaited<
      ReturnType<DockerContainerLifecycleService['getContainerRuntimeState']>
    >,
  ) {
    if (!runtimeState.exists) {
      return 'Managed container no longer exists before Android finished booting.';
    }

    const exitCode =
      runtimeState.exitCode === null || runtimeState.exitCode === undefined
        ? ''
        : ` with exit code ${runtimeState.exitCode}`;
    const dockerError = runtimeState.error
      ? ` Docker reported: ${runtimeState.error}`
      : '';
    const oomKilled = runtimeState.oomKilled
      ? ' Docker reported that the container was OOM-killed.'
      : '';

    return `Managed container ${runtimeState.status ?? 'exited'}${exitCode} before Android finished booting.${oomKilled}${dockerError}`;
  }

  private async collectBootDiagnostics(app: AndroidApplication) {
    this.assertContainerId(app);
    const command = [
      'sh',
      '-lc',
      [
        'echo "== props =="',
        'for prop in dev.bootcomplete service.bootanim.exit init.svc.bootanim init.svc.zygote init.svc.zygote64 init.svc.surfaceflinger init.svc.servicemanager init.svc.hwservicemanager init.svc.adbd ro.hardware ro.boot.use_memfd sys.use_memfd; do printf "%s=" "$prop"; getprop "$prop" 2>/dev/null || true; done',
        'echo "== binder devices =="',
        'ls -la /dev/binder /dev/hwbinder /dev/vndbinder /dev/ashmem /dev/binderfs 2>&1 || true',
        'echo "== binder proc =="',
        'cat /proc/filesystems /proc/misc 2>/dev/null | grep -E "binder|ashmem" || true',
        'echo "== mounts =="',
        'mount | grep -E "binder|ashmem|/data" || true',
        'echo "== processes =="',
        'ps -A 2>/dev/null | head -80 || ps 2>/dev/null | head -80 || true',
        'echo "== data =="',
        'df -h /data 2>&1 || true',
        'ls -la /data 2>&1 | head -40 || true',
      ].join('; '),
    ];

    let probe: string;
    try {
      const { stdout, stderr } = await this.exec.execInContainerWithOutput(
        app.containerId,
        command,
        { timeoutMs: 15_000 },
      );
      probe = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    } catch (error) {
      probe = getErrorMessage(error);
    }

    let containerLogs: string;
    try {
      containerLogs = await this.lifecycle.getContainerLogs(
        app.containerId,
        200,
      );
    } catch (error) {
      containerLogs = getErrorMessage(error);
    }

    const combined = `${probe}\n${containerLogs}`.toLowerCase();
    const summary = androidBootDiagnosticSummary(combined);

    return {
      summary,
      probe: truncateDiagnosticText(probe, 12_000),
      containerLogs: truncateDiagnosticText(containerLogs, 12_000),
    };
  }
}
