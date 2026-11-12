import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import {
  OperationDeadline,
  OperationDeadlineExceededError,
} from '../../../common/operation-deadline';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_ENGINE,
  type DockerEnginePort,
} from '../../../docker/contracts/docker-engine.port';
import {
  DOCKER_SIDECAR,
  type DockerSidecarPort,
} from '../../../docker/contracts/docker-sidecar.port';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
import { isRedroidRuntime } from '@rebroid/android-application-core/redroid-runtime';
import {
  androidBootDiagnosticSummary,
  androidBootProbeProperties,
  parseAndroidBootReadiness,
  truncateDiagnosticText,
} from '../utils/android-apps-android-provisioning.utils';

const bootCheckIntervalMs = 1_000;
const maxUnchangedBootProbeIntervalMs = 3_000;
const adbSetupObservationTtlMs = 3_000;
const adbPropertySetupTimeoutMs = 10_000;

type RemoteAccessTimings = {
  propertySetupMs: number;
  networkAttachmentMs: number;
  adbProbeMs: number;
  adbProbeAttempts: number;
};

@Injectable()
export class AndroidAppsProvisioningAndroidService {
  private readonly logger = new Logger(
    AndroidAppsProvisioningAndroidService.name,
  );

  constructor(
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    @Inject(DOCKER_ENGINE)
    private readonly engine: DockerEnginePort,
    @Inject(DOCKER_SIDECAR)
    private readonly sidecar: DockerSidecarPort,
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
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'Android boot readiness was not reported.';
    let nextProbeAt = Date.now();
    let probeIntervalMs = bootCheckIntervalMs;
    const probeCommand = [
      'sh',
      '-lc',
      androidBootProbeProperties
        .map(
          (prop) =>
            `printf '${prop}='; getprop ${prop} 2>/dev/null || true; printf '\\n'`,
        )
        .join('; '),
    ];

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);
      const [probeResult, runtimeStateResult] = await Promise.allSettled([
        Date.now() >= nextProbeAt
          ? this.exec.execInContainerWithOutput(app.containerId, probeCommand, {
              timeoutMs: 10_000,
            })
          : undefined,
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

      if (probeResult.status === 'fulfilled' && probeResult.value) {
        const { stdout, stderr } = probeResult.value;
        const readiness = parseAndroidBootReadiness(stdout);
        const observation = [readiness.probe, stderr.trim()]
          .filter(Boolean)
          .join(' ');

        if (readiness.ready) {
          await this.logs.append(app.id, 'Android boot completed', {
            probe: observation,
          });
          return;
        }
        probeIntervalMs =
          observation === lastProbe
            ? Math.min(
                probeIntervalMs + bootCheckIntervalMs,
                maxUnchangedBootProbeIntervalMs,
              )
            : bootCheckIntervalMs;
        lastProbe = observation;
        nextProbeAt = Date.now() + probeIntervalMs;
      } else if (probeResult.status === 'rejected') {
        lastProbe = getErrorMessage(probeResult.reason);
        probeIntervalMs = bootCheckIntervalMs;
        nextProbeAt = Date.now() + probeIntervalMs;
      }

      await delay(bootCheckIntervalMs);
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
    return isRedroidRuntime(app.containerImage, app.runtimeKind);
  }

  /** Turns on remote ADB access for redroid. */
  async prepareRemoteAccess(app: AndroidApplication, reservationId?: string) {
    this.assertContainerId(app);
    const timeoutMs =
      this.config.getOrThrow<number>('app.redroid.adbTimeoutSeconds') * 1000;
    const deadline = new OperationDeadline(timeoutMs);
    const startedAt = performance.now();
    const timings: RemoteAccessTimings = {
      propertySetupMs: 0,
      networkAttachmentMs: 0,
      adbProbeMs: 0,
      adbProbeAttempts: 0,
    };
    const command = [
      'sh',
      '-lc',
      [
        'set -e',
        `port=${app.adbPort}`,
        'persist_port="$(getprop persist.adb.tcp.port 2>/dev/null || true)"',
        'service_port="$(getprop service.adb.tcp.port 2>/dev/null || true)"',
        'adbd_state="$(getprop init.svc.adbd 2>/dev/null || true)"',
        'if { [ "$persist_port" = "$port" ] || [ "$service_port" = "$port" ]; } && [ "$adbd_state" = "running" ]; then exit 0; fi',
        `setprop persist.adb.tcp.port ${app.adbPort}`,
        `setprop service.adb.tcp.port ${app.adbPort}`,
        'if [ "$adbd_state" = "running" ]; then stop adbd; fi',
        'start adbd',
      ].join('\n'),
    ];
    try {
      await this.retryTransientRemoteAccessSetup(
        app,
        command,
        deadline,
      ).finally(() => {
        timings.propertySetupMs = Math.round(performance.now() - startedAt);
      });
      deadline.throwIfExpired();
      await this.waitForRedroidAdbFromSidecar(app, deadline, timings);
      this.tracker.ensureActive(app.id);
      await this.logs.append(app.id, 'Prepared Android remote access', {
        adbPort: app.adbPort,
        reservationId,
        ...timings,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      this.logger.debug({
        message: 'Android remote access preparation failed.',
        applicationId: app.id,
        reservationId,
        ...timings,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      if (error instanceof OperationDeadlineExceededError) {
        throw new Error(
          `Timed out preparing Android remote access after ${timeoutMs / 1000}s.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  /** Waits until the sidecar can reach ADB. */
  private async waitForRedroidAdbFromSidecar(
    app: AndroidApplication,
    deadline: OperationDeadline,
    timings: RemoteAccessTimings,
  ) {
    this.assertContainerId(app);

    const intervalMs = 1_000;
    let lastProbe = 'ADB sidecar readiness was not reported.';
    let setup:
      | {
          generation: number;
          observation: Awaited<
            ReturnType<
              AndroidAppsViewerNetworkService['observeProvisioningAdbTarget']
            >
          >;
          attachment: Awaited<
            ReturnType<DockerSidecarPort['ensureSidecarOnNetwork']>
          >;
          expiresAt: number;
        }
      | undefined;

    while (deadline.remainingMs() > 0) {
      this.tracker.ensureActive(app.id);
      let runtimeState;
      let sidecarTarget;
      let observation;
      const recentSetup =
        setup &&
        setup.generation === this.sidecar.adbTargetGeneration &&
        setup.expiresAt > performance.now()
          ? setup
          : undefined;
      try {
        const [runtime, attachment, target] = await Promise.allSettled([
          this.lifecycle.getContainerRuntimeState(app.containerId),
          recentSetup?.attachment ??
            this.attachSidecar(app.networkName, deadline, timings),
          recentSetup?.observation ??
            this.viewerNetwork.observeProvisioningAdbTarget(app),
        ]);
        this.tracker.ensureActive(app.id);
        if (runtime.status === 'rejected') throw runtime.reason;
        if (attachment.status === 'rejected') throw attachment.reason;
        if (target.status === 'rejected') throw target.reason;
        runtimeState = runtime.value;
        sidecarTarget = attachment.value;
        observation = target.value;
      } catch (error) {
        setup = undefined;
        if (!this.engine.isTransientDockerTransportError(error)) {
          throw error;
        }

        lastProbe = getErrorMessage(error);
        this.logger.warn(
          `Redroid ADB sidecar readiness for ${app.id} hit a transient Docker transport error: ${lastProbe}`,
        );
        await delay(Math.min(intervalMs, deadline.remainingMs()));
        continue;
      }
      deadline.throwIfExpired();

      if (!runtimeState.exists || !runtimeState.running) {
        throw new Error(this.androidBootExitedMessage(runtimeState));
      }

      if (!sidecarTarget.configured || !sidecarTarget.connected) {
        setup = undefined;
        lastProbe =
          sidecarTarget.message ??
          sidecarTarget.error?.message ??
          'Display sidecar is not attached to the app network.';
        await delay(Math.min(intervalMs, deadline.remainingMs()));
        continue;
      }

      const generation = sidecarTarget.sidecarGeneration;
      if (generation !== this.sidecar.adbTargetGeneration) {
        setup = undefined;
        await delay(Math.min(intervalMs, deadline.remainingMs()));
        continue;
      }
      setup = recentSetup ?? {
        generation,
        observation,
        attachment: sidecarTarget,
        expiresAt: performance.now() + adbSetupObservationTtlMs,
      };
      const { adbHost } = observation;
      const adbProbeStartedAt = performance.now();
      timings.adbProbeAttempts += 1;
      const adbTarget = await this.sidecar
        .connectAdb(adbHost, app.adbPort, deadline)
        .finally(() => {
          timings.adbProbeMs += Math.round(
            performance.now() - adbProbeStartedAt,
          );
        });
      this.tracker.ensureActive(app.id);
      lastProbe =
        adbTarget.message ??
        adbTarget.error?.message ??
        `No ADB response from ${adbHost}:${app.adbPort}.`;
      deadline.throwIfExpired();

      await this.logs.append(app.id, 'Redroid ADB sidecar probe', {
        networkName: app.networkName,
        adbHost,
        adbPort: app.adbPort,
        configured: adbTarget.configured,
        connected: adbTarget.connected,
        message: adbTarget.message,
        error: adbTarget.error?.message ?? null,
      });
      this.tracker.ensureActive(app.id);
      deadline.throwIfExpired();

      if (
        generation !== this.sidecar.adbTargetGeneration ||
        !adbTarget.configured
      ) {
        setup = undefined;
      } else if (adbTarget.connected) {
        this.viewerNetwork.rememberProvisionedAdb(app, {
          ...observation,
          sidecarGeneration: generation,
          target: adbTarget,
        });
        return;
      }

      if (adbTarget.error?.code === 'adb_missing') {
        throw new Error(lastProbe);
      }
      await delay(Math.min(intervalMs, deadline.remainingMs()));
    }

    throw new Error(
      `Timed out waiting for redroid ADB from display sidecar after ${deadline.timeoutMs / 1000}s. Last probe: ${lastProbe}`,
    );
  }

  private async attachSidecar(
    networkName: string,
    deadline: OperationDeadline,
    timings: RemoteAccessTimings,
  ) {
    const startedAt = performance.now();
    try {
      return await this.sidecar.ensureSidecarOnNetwork(networkName, deadline);
    } finally {
      timings.networkAttachmentMs += Math.round(performance.now() - startedAt);
    }
  }

  private async retryTransientRemoteAccessSetup(
    app: AndroidApplication & { containerId: string },
    command: string[],
    deadline: OperationDeadline,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.tracker.ensureActive(app.id);
      deadline.throwIfExpired();
      const guestTimeoutMs = Math.min(
        adbPropertySetupTimeoutMs,
        deadline.remainingMs(),
      );
      const termSeconds = Math.max(1, guestTimeoutMs - 1_000) / 1_000;
      try {
        // Disconnecting Docker's exec stream does not stop the Android shell.
        await this.exec.execInContainer(
          app.containerId,
          ['timeout', '-k', '1s', `${termSeconds}s`, ...command],
          { deadline },
        );
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
        await delay(Math.min(500 * attempt, deadline.remainingMs()));
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
      ReturnType<DockerContainerLifecyclePort['getContainerRuntimeState']>
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
