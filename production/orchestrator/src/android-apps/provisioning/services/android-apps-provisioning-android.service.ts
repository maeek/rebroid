import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { DockerSidecarService } from '../../../docker/sidecar/services/docker-sidecar.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
import { isRedroidImageName } from '../utils/redroid-runtime.utils';

@Injectable()
export class AndroidAppsProvisioningAndroidService {
  constructor(
    private readonly exec: DockerContainerExecService,
    private readonly lifecycle: DockerContainerLifecycleService,
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
    const intervalMs = 2_000;
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'sys.boot_completed was not reported.';

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);
      const runtimeState = await this.lifecycle.getContainerRuntimeState(
        app.containerId,
      );

      if (!runtimeState.exists || !runtimeState.running) {
        throw new Error(this.androidBootExitedMessage(runtimeState));
      }

      try {
        const { stdout, stderr } = await this.exec.execInContainerWithOutput(
          app.containerId,
          ['sh', '-lc', 'getprop sys.boot_completed 2>/dev/null || true'],
          { timeoutMs: 10_000 },
        );
        const bootCompleted = stdout.trim();
        lastProbe =
          stderr.trim() ||
          (bootCompleted
            ? `sys.boot_completed=${bootCompleted}`
            : 'sys.boot_completed was empty.');

        if (bootCompleted === '1') {
          await this.logs.append(app.id, 'Android boot completed', {
            probe: lastProbe,
          });
          return;
        }
      } catch (error) {
        const runtimeStateAfterExec =
          await this.lifecycle.getContainerRuntimeState(app.containerId);

        if (!runtimeStateAfterExec.exists || !runtimeStateAfterExec.running) {
          throw new Error(this.androidBootExitedMessage(runtimeStateAfterExec));
        }

        lastProbe = getErrorMessage(error);
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

    await this.exec.execInContainer(app.containerId, [
      'sh',
      '-lc',
      [
        `setprop persist.adb.tcp.port ${app.adbPort}`,
        `setprop service.adb.tcp.port ${app.adbPort}`,
        'stop adbd',
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
    const intervalMs = 2_000;
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'ADB sidecar readiness was not reported.';

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);
      const runtimeState = await this.lifecycle.getContainerRuntimeState(
        app.containerId,
      );

      if (!runtimeState.exists || !runtimeState.running) {
        throw new Error(this.androidBootExitedMessage(runtimeState));
      }

      const sidecarTarget = await this.sidecar.ensureSidecarOnNetwork(
        app.networkName,
      );
      if (!sidecarTarget.configured || !sidecarTarget.connected) {
        lastProbe =
          sidecarTarget.message ??
          sidecarTarget.error?.message ??
          'Display sidecar is not attached to the app network.';
        await delay(intervalMs);
        continue;
      }

      const adbHost = await this.viewerNetwork.resolveScrcpyAdbHost(app);
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

    return `Managed container ${runtimeState.status ?? 'exited'}${exitCode} before Android finished booting.${dockerError}`;
  }

  private async collectBootDiagnostics(app: AndroidApplication) {
    this.assertContainerId(app);
    const command = [
      'sh',
      '-lc',
      [
        'echo "== props =="',
        'for prop in sys.boot_completed dev.bootcomplete init.svc.bootanim init.svc.zygote init.svc.zygote64 init.svc.surfaceflinger init.svc.servicemanager init.svc.hwservicemanager init.svc.adbd ro.hardware ro.boot.use_memfd sys.use_memfd; do printf "%s=" "$prop"; getprop "$prop" 2>/dev/null || true; done',
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

    let probe = '';
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

    let containerLogs = '';
    try {
      containerLogs = await this.lifecycle.getContainerLogs(
        app.containerId,
        200,
      );
    } catch (error) {
      containerLogs = getErrorMessage(error);
    }

    const combined = `${probe}\n${containerLogs}`.toLowerCase();
    const summary = this.bootDiagnosticSummary(combined);

    return {
      summary,
      probe: this.truncate(probe, 12_000),
      containerLogs: this.truncate(containerLogs, 12_000),
    };
  }

  private bootDiagnosticSummary(text: string) {
    const reasons: string[] = [];
    if (
      text.includes('binder') &&
      text.match(/no such file|not found|cannot access/)
    ) {
      reasons.push(
        'binder devices may be missing inside the runtime container',
      );
    }
    if (text.includes('permission denied')) {
      reasons.push(
        'container permissions or security profile may be blocking Redroid',
      );
    }
    if (
      text.includes('avc:') ||
      text.includes('apparmor') ||
      text.includes('seccomp')
    ) {
      reasons.push('host security policy may be blocking Redroid');
    }
    if (text.includes('no space left')) {
      reasons.push('runtime data volume or Docker storage may be full');
    }
    if (text.includes('zygote') && !text.includes('init.svc.zygote=running')) {
      reasons.push('Android zygote service is not running');
    }
    if (
      text.includes('ashmem') &&
      text.match(/no such file|not found|cannot access|couldn't create ashmem/)
    ) {
      if (
        text.includes('ro.boot.use_memfd=true') ||
        text.includes('sys.use_memfd=true')
      ) {
        reasons.push(
          'Android display stack is still trying to use ashmem even though memfd is enabled; host /dev/ashmem support may still be required for this image',
        );
      } else {
        reasons.push(
          'Android display stack is trying to use ashmem; recreate the container with androidboot.use_memfd=true',
        );
      }
    }

    return (
      reasons.join('; ') ||
      'no obvious boot blocker detected from container diagnostics'
    );
  }

  private truncate(value: string, maxLength: number) {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}\n... truncated ${value.length - maxLength} chars`;
  }
}
