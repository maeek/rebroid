import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
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
  type DockerSidecarAttachmentTimings,
} from '../../../docker/contracts/docker-sidecar.port';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsTcpAdbService } from '../../common/services/android-apps-tcp-adb.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsViewerNetworkService } from '../../viewer/services/android-apps-viewer-network.service';
import { isRedroidRuntime } from '@rebroid/android-application-core/redroid-runtime';
import {
  androidBootDiagnosticSummary,
  androidBootProbeCommand,
  parseAndroidBootReadiness,
  truncateDiagnosticText,
} from '../utils/android-apps-android-provisioning.utils';
import { AndroidBootOperationTimer } from '../utils/android-boot-operation-timer';
import {
  androidBootEventCommand,
  parseAndroidBootEvents,
} from '../utils/android-boot-events';

const bootCheckIntervalMs = 1_000;
const maxUnchangedBootProbeIntervalMs = 3_000;
const adbSetupObservationTtlMs = 3_000;
const maxConsecutiveObservationFailures = 3;
const bootDiagnosticTimeoutMs = 5_000;
const bootEventTimeoutMs = 2_000;

type BootPropertySample = {
  sequence: number;
  dispatchedAfterMs: number | null;
  settledAfterMs: number;
};

type BootEventObservation = {
  applicationId: string;
  containerId: string;
  reservationId: string;
  bootObservationId: string;
  startedAtMs: number;
  readySampleSettledAtMs: number;
  lastNotReadySample: BootPropertySample | null;
  readySample: BootPropertySample;
};

type PreparedNetworkAttachment = {
  reservationId: string;
  containerId: string;
  networkName: string;
  expiresAt: number;
  attachment: Awaited<ReturnType<DockerSidecarPort['ensureSidecarOnNetwork']>>;
};

type RemoteAccessTimings = {
  propertySetupMs: number;
  networkAttachmentMs: number;
  networkAttachment: DockerSidecarAttachmentTimings;
  adbProbeMs: number;
  adbProbeAttempts: number;
};

@Injectable()
export class AndroidAppsProvisioningAndroidService {
  private readonly logger = new Logger(
    AndroidAppsProvisioningAndroidService.name,
  );
  private bootEventReadPending = false;

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
    private readonly tcpAdb: AndroidAppsTcpAdbService,
  ) {}

  async prepareRuntime(
    app: AndroidApplication,
    reservationId: string,
    beforeRemoteAccess: () => Promise<void>,
  ) {
    // startWithPolicy has completed. Drain both branches before releasing the
    // reservation, including boot failure and cancellation during attachment.
    const bootStartedAt = performance.now();
    const observeBootSettlement = (outcome: 'fulfilled' | 'rejected') => {
      const settledAt = performance.now();
      // Record before joining attachment, without adding persistence to readiness.
      this.logger.log({
        event: 'android_boot_observation_settled',
        reservationId,
        applicationId: app.id,
        containerId: app.containerId,
        outcome,
        settledAt: new Date().toISOString(),
        elapsedMs: Math.round(settledAt - bootStartedAt),
      });
      return settledAt;
    };
    const [boot, attachment] = await Promise.allSettled([
      this.waitForAndroidBoot(app, reservationId).then(
        (observation) => ({
          observation,
          settledAt: observeBootSettlement('fulfilled'),
        }),
        (error: unknown) => {
          observeBootSettlement('rejected');
          throw error;
        },
      ),
      this.prepareNetworkAttachment(app, reservationId),
    ]);
    this.tracker.ensureActive(app.id);
    if (boot.status === 'rejected') throw boot.reason;
    if (attachment.status === 'rejected') throw attachment.reason;
    await beforeRemoteAccess();
    this.tracker.ensureActive(app.id);
    await this.prepareRemoteAccess(
      app,
      reservationId,
      attachment.value,
      boot.value.settledAt,
    );
    if (boot.value.observation) {
      this.scheduleBootEventRead(boot.value.observation);
    }
  }

  /** Waits until Android reports that boot is done. */
  async waitForAndroidBoot(app: AndroidApplication, reservationId?: string) {
    this.assertContainerId(app);
    return this.tracker.withCancellation(app.id, (signal) =>
      this.observeAndroidBoot(app, signal, reservationId),
    );
  }

  private async observeAndroidBoot(
    app: AndroidApplication & { containerId: string },
    signal: AbortSignal,
    reservationId?: string,
  ) {
    const timeoutMs =
      this.config.getOrThrow<number>('app.redroid.bootTimeoutSeconds') * 1000;
    const deadline = new OperationDeadline(timeoutMs);
    const bootStartedAt = performance.now();
    const bootObservationId = randomUUID();
    let observationSequence = 0;
    let previousObservationSettledAt = bootStartedAt;
    let lastProbe = 'Android boot readiness was not reported.';
    let nextProbeAt = performance.now();
    let probeIntervalMs = bootCheckIntervalMs;
    let stateFailures = 0;
    let probeFailures = 0;
    let guestShellObserved = false;
    let initialGuestUnavailableAt: number | undefined;
    let guestUnavailableObservations = 0;
    let lastNotReady:
      | { startedAt?: string | null; sample: BootPropertySample }
      | undefined;
    const probeCommand = androidBootProbeCommand();

    while (deadline.remainingMs() > 0) {
      this.tracker.ensureActive(app.id);
      signal.throwIfAborted();
      const observationDeadline = new OperationDeadline(
        Math.min(10_000, deadline.remainingMs()),
      );
      const observationStartedAt = performance.now();
      const propertyTimer =
        observationStartedAt >= nextProbeAt
          ? new AndroidBootOperationTimer(bootStartedAt)
          : undefined;
      const runtimeTimer = new AndroidBootOperationTimer(bootStartedAt);
      let propertySettledAtMs = 0;
      const [probeResult, runtime] = await Promise.allSettled([
        propertyTimer?.run((onDispatched) =>
          this.exec
            .execInContainerWithOutput(app.containerId, probeCommand, {
              deadline: observationDeadline,
              signal,
              onDispatched,
            })
            .finally(() => {
              propertySettledAtMs = Date.now();
            }),
        ),
        runtimeTimer.run((onDispatched) =>
          this.lifecycle.getContainerRuntimeState(app.containerId, {
            deadline: observationDeadline,
            signal,
            onDispatched,
          }),
        ),
      ]);
      const readiness =
        probeResult.status === 'fulfilled' && probeResult.value
          ? parseAndroidBootReadiness(probeResult.value.stdout)
          : undefined;
      const observationSettledAt = performance.now();
      const propertyTimings = propertyTimer?.snapshot();
      this.logger.log({
        event: 'android_boot_probe',
        applicationId: app.id,
        containerId: app.containerId,
        reservationId: reservationId ?? null,
        bootObservationId,
        sequence: ++observationSequence,
        observedAt: new Date().toISOString(),
        elapsedMs: Math.round(observationSettledAt - bootStartedAt),
        waitSincePreviousObservationMs: Math.round(
          observationStartedAt - previousObservationSettledAt,
        ),
        observationMs: Math.round(observationSettledAt - observationStartedAt),
        properties: propertyTimings ?? { outcome: 'skipped_backoff' },
        runtime: runtimeTimer.snapshot(),
        propertyReady: readiness?.ready ?? null,
        runtimeRunning:
          runtime.status === 'fulfilled'
            ? runtime.value.exists && runtime.value.running
            : null,
        initialGuestShellUnavailable:
          !guestShellObserved &&
          probeResult.status === 'rejected' &&
          this.isInitialGuestShellUnavailable(probeResult.reason),
        cancelled: signal.aborted,
      });
      previousObservationSettledAt = observationSettledAt;
      this.tracker.ensureActive(app.id);
      signal.throwIfAborted();
      // A terminal runtime observation wins even if the property probe timed out.
      if (
        runtime.status === 'fulfilled' &&
        (!runtime.value.exists || !runtime.value.running)
      ) {
        throw new Error(this.androidBootExitedMessage(runtime.value));
      }
      if (deadline.remainingMs() === 0) break;
      if (runtime.status === 'rejected') {
        lastProbe = getErrorMessage(runtime.reason);
        if (
          !this.isRetryableBootObservation(runtime.reason) ||
          ++stateFailures >= maxConsecutiveObservationFailures
        ) {
          throw runtime.reason;
        }
        // Successful properties alone cannot establish that this runtime is still running.
        await delay(
          Math.min(bootCheckIntervalMs, deadline.remainingMs()),
          undefined,
          { signal },
        );
        continue;
      }
      stateFailures = 0;
      if (
        probeResult.status === 'fulfilled' &&
        probeResult.value &&
        readiness &&
        propertyTimings
      ) {
        if (!guestShellObserved && initialGuestUnavailableAt !== undefined) {
          this.logger.log({
            event: 'android_guest_shell_available',
            applicationId: app.id,
            containerId: app.containerId,
            observedAt: new Date().toISOString(),
            elapsedMs: Math.round(
              performance.now() - initialGuestUnavailableAt,
            ),
            unavailableObservations: guestUnavailableObservations,
          });
        }
        guestShellObserved = true;
        probeFailures = 0;
        const observation = [readiness.probe, probeResult.value.stderr.trim()]
          .filter(Boolean)
          .join(' ');
        const sample = {
          sequence: observationSequence,
          dispatchedAfterMs: propertyTimings.dispatchedAfterMs,
          settledAfterMs: propertyTimings.settledAfterMs,
        };
        const containerStartedAt = runtime.value.startedAt;
        if (readiness.ready) {
          const lastNotReadySample =
            lastNotReady?.startedAt === containerStartedAt
              ? (lastNotReady?.sample ?? null)
              : null;
          await this.logs.append(app.id, 'Android boot completed', {
            probe: observation,
            containerId: app.containerId,
            reservationId: reservationId ?? null,
            bootObservationId,
            lastNotReadySample,
            readySample: sample,
          });
          this.tracker.ensureActive(app.id);
          signal.throwIfAborted();
          const startedAtMs = containerStartedAt
            ? Date.parse(containerStartedAt)
            : Number.NaN;
          if (
            reservationId &&
            startedAtMs > 0 &&
            startedAtMs < propertySettledAtMs &&
            this.config.get<boolean>('app.redroid.collectBootEvents')
          ) {
            return {
              applicationId: app.id,
              containerId: app.containerId,
              reservationId,
              bootObservationId,
              startedAtMs,
              readySampleSettledAtMs: propertySettledAtMs,
              lastNotReadySample,
              readySample: sample,
            } satisfies BootEventObservation;
          }
          return undefined;
        }
        lastNotReady = { startedAt: containerStartedAt, sample };
        probeIntervalMs =
          observation === lastProbe
            ? Math.min(
                probeIntervalMs + bootCheckIntervalMs,
                maxUnchangedBootProbeIntervalMs,
              )
            : bootCheckIntervalMs;
        lastProbe = observation;
        nextProbeAt = performance.now() + probeIntervalMs;
      } else if (probeResult.status === 'rejected') {
        lastProbe = getErrorMessage(probeResult.reason);
        if (
          !guestShellObserved &&
          this.isInitialGuestShellUnavailable(probeResult.reason)
        ) {
          // Redroid may be running before its initial guest shell is available.
          // This boot observation uses the full boot budget, not transport retries.
          guestUnavailableObservations += 1;
          if (initialGuestUnavailableAt === undefined) {
            initialGuestUnavailableAt = performance.now();
            this.logger.log({
              event: 'android_guest_shell_unavailable',
              applicationId: app.id,
              containerId: app.containerId,
              observedAt: new Date().toISOString(),
            });
          }
          probeFailures = 0;
        } else if (
          !this.isRetryableBootObservation(probeResult.reason) ||
          ++probeFailures >= maxConsecutiveObservationFailures
        ) {
          throw probeResult.reason;
        }
        probeIntervalMs = bootCheckIntervalMs;
        nextProbeAt = performance.now() + probeIntervalMs;
      }
      await delay(
        Math.min(bootCheckIntervalMs, deadline.remainingMs()),
        undefined,
        { signal },
      );
    }

    this.tracker.ensureActive(app.id);
    signal.throwIfAborted();
    const diagnostics = await this.collectBootDiagnostics(app, signal);
    this.tracker.ensureActive(app.id);
    signal.throwIfAborted();
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

  private scheduleBootEventRead(observation: BootEventObservation) {
    if (this.bootEventReadPending) return;
    this.bootEventReadPending = true;
    setImmediate(() => {
      void this.collectBootEvents(observation).finally(() => {
        this.bootEventReadPending = false;
      });
    }).unref();
  }

  private async collectBootEvents(observation: BootEventObservation) {
    const { startedAtMs, readySampleSettledAtMs, ...identityAndSamples } =
      observation;
    const details = {
      event: 'android_boot_guest_events',
      ...identityAndSamples,
      containerStartedAt: new Date(startedAtMs).toISOString(),
      readySampleSettledAt: new Date(readySampleSettledAtMs).toISOString(),
    };
    try {
      await this.tracker.withCancellation(
        observation.applicationId,
        async (signal) => {
          const { stdout } = await this.exec.execInContainerWithOutput(
            observation.containerId,
            androidBootEventCommand(startedAtMs),
            { deadline: new OperationDeadline(bootEventTimeoutMs), signal },
          );
          signal.throwIfAborted();
          const events = parseAndroidBootEvents(
            stdout,
            startedAtMs,
            readySampleSettledAtMs,
          );
          this.logger.log({
            ...details,
            outcome: events.length ? 'collected' : 'empty',
            events,
          });
        },
      );
    } catch {
      this.logger.log({ ...details, outcome: 'unavailable' });
    }
  }

  private isInitialGuestShellUnavailable(error: unknown): boolean {
    if (!(error instanceof ContainerCommandFailedException)) return false;
    const { command, exitCode, stderr } = error.details;
    return (
      exitCode === 255 &&
      command[0] === 'sh' &&
      command[1] === '-lc' &&
      stderr?.trim() === 'exec /bin/sh: no such file or directory'
    );
  }

  private isRetryableBootObservation(error: unknown): boolean {
    return (
      error instanceof OperationDeadlineExceededError ||
      this.engine.isTransientDockerTransportError(error)
    );
  }

  /** Checks if this image needs ADB port setup. */
  shouldPrepareRemoteAccess(app: AndroidApplication) {
    return isRedroidRuntime(app.containerImage, app.runtimeKind);
  }

  /** Admitted after guarded runtime start; callers must join this work before teardown. */
  async prepareNetworkAttachment(
    app: AndroidApplication,
    reservationId: string,
  ): Promise<PreparedNetworkAttachment | undefined> {
    return this.tracker.withCancellation(app.id, async (signal) => {
      this.assertContainerId(app);
      this.tracker.ensureActive(app.id);
      const { containerId, networkName } = app;
      const deadline = new OperationDeadline(
        this.config.getOrThrow<number>('app.redroid.adbTimeoutSeconds') * 1000,
      );
      const timings = this.remoteAccessTimings();
      let outcome = 'failed';
      try {
        const attachment = await this.attachSidecar(
          networkName,
          deadline,
          timings,
          signal,
        );
        this.tracker.ensureActive(app.id);
        deadline.throwIfExpired();
        outcome = attachment.connected ? 'connected' : 'unavailable';
        return {
          reservationId,
          containerId,
          networkName,
          attachment,
          expiresAt: performance.now() + adbSetupObservationTtlMs,
        };
      } catch (error) {
        this.tracker.ensureActive(app.id);
        if (
          error instanceof OperationDeadlineExceededError ||
          this.engine.isTransientDockerTransportError(error)
        ) {
          outcome = 'retry_after_boot';
          return undefined;
        }
        throw error;
      } finally {
        await this.logs.append(app.id, 'Android network attachment completed', {
          reservationId,
          containerId,
          networkName,
          outcome,
          networkAttachmentMs: timings.networkAttachmentMs,
          ...timings.networkAttachment,
        });
      }
    });
  }

  /** Turns on remote ADB access for redroid after Android boot. */
  async prepareRemoteAccess(
    app: AndroidApplication,
    reservationId?: string,
    preparedNetwork?: PreparedNetworkAttachment,
    readinessStartedAt = performance.now(),
  ) {
    return this.tracker.withCancellation(app.id, async (signal) => {
      this.assertContainerId(app);
      const timeoutMs =
        this.config.getOrThrow<number>('app.redroid.adbTimeoutSeconds') * 1000;
      const startedAt = performance.now();
      const attachmentWaitAfterBootMs = Math.max(
        0,
        startedAt - readinessStartedAt,
      );
      const deadline = new OperationDeadline(
        Math.max(0, timeoutMs - attachmentWaitAfterBootMs),
      );
      const timings = this.remoteAccessTimings();
      try {
        await this.tcpAdb.prepare(app, deadline, signal).finally(() => {
          timings.propertySetupMs = Math.round(performance.now() - startedAt);
        });
        deadline.throwIfExpired();
        const initialAttachment =
          preparedNetwork &&
          preparedNetwork.reservationId === reservationId &&
          preparedNetwork.containerId === app.containerId &&
          preparedNetwork.networkName === app.networkName &&
          preparedNetwork.expiresAt > performance.now() &&
          preparedNetwork.attachment.sidecarGeneration ===
            this.sidecar.adbTargetGeneration
            ? preparedNetwork.attachment
            : undefined;
        await this.waitForRedroidAdbFromSidecar(
          app,
          deadline,
          timings,
          initialAttachment,
          signal,
        );
        this.tracker.ensureActive(app.id);
        await this.logs.append(app.id, 'Prepared Android remote access', {
          adbPort: app.adbPort,
          reservationId,
          ...timings,
          attachmentWaitAfterBootMs: Math.round(attachmentWaitAfterBootMs),
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        this.logger.debug({
          message: 'Android remote access preparation failed.',
          applicationId: app.id,
          reservationId,
          ...timings,
          attachmentWaitAfterBootMs: Math.round(attachmentWaitAfterBootMs),
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
    });
  }

  /** Waits until the sidecar can reach ADB. */
  private async waitForRedroidAdbFromSidecar(
    app: AndroidApplication,
    deadline: OperationDeadline,
    timings: RemoteAccessTimings,
    initialAttachment?: PreparedNetworkAttachment['attachment'],
    signal?: AbortSignal,
  ) {
    this.assertContainerId(app);

    const intervalMs = 1_000;
    // Activation can launch an attached APK before anyone opens a viewer.
    const purpose = app.apkFilePath ? 'interactive' : 'transport';
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
          this.lifecycle.getContainerRuntimeState(app.containerId, {
            deadline,
            signal,
          }),
          recentSetup?.attachment ??
            initialAttachment ??
            this.attachSidecar(app.networkName, deadline, timings, signal),
          recentSetup?.observation ??
            this.viewerNetwork.observeProvisioningAdbTarget(app, {
              deadline,
              signal,
            }),
        ]);
        initialAttachment = undefined;
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
        await delay(Math.min(intervalMs, deadline.remainingMs()), undefined, {
          signal,
        });
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
        await delay(Math.min(intervalMs, deadline.remainingMs()), undefined, {
          signal,
        });
        continue;
      }

      const generation = sidecarTarget.sidecarGeneration;
      if (generation !== this.sidecar.adbTargetGeneration) {
        setup = undefined;
        await delay(Math.min(intervalMs, deadline.remainingMs()), undefined, {
          signal,
        });
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
        .connectAdb(adbHost, app.adbPort, deadline, signal, purpose)
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
        purpose,
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
          purpose,
        });
        return;
      }

      if (adbTarget.error?.code === 'adb_missing') {
        throw new Error(lastProbe);
      }
      await delay(Math.min(intervalMs, deadline.remainingMs()), undefined, {
        signal,
      });
    }

    throw new Error(
      `Timed out waiting for redroid ADB from display sidecar after ${deadline.timeoutMs / 1000}s. Last probe: ${lastProbe}`,
    );
  }

  private remoteAccessTimings(): RemoteAccessTimings {
    return {
      propertySetupMs: 0,
      networkAttachmentMs: 0,
      networkAttachment: {
        sidecarQueueMs: 0,
        sidecarPreparationMs: 0,
        networkInspectMs: 0,
        dockerMutationQueueMs: 0,
        networkConnectMs: 0,
        networkConvergenceMs: 0,
      },
      adbProbeMs: 0,
      adbProbeAttempts: 0,
    };
  }

  private async attachSidecar(
    networkName: string,
    deadline: OperationDeadline,
    timings: RemoteAccessTimings,
    signal?: AbortSignal,
  ) {
    const startedAt = performance.now();
    try {
      return await this.sidecar.ensureSidecarOnNetwork(
        networkName,
        deadline,
        timings.networkAttachment,
        signal,
      );
    } finally {
      timings.networkAttachmentMs += Math.round(performance.now() - startedAt);
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

  private async collectBootDiagnostics(
    app: AndroidApplication,
    signal: AbortSignal,
  ) {
    const deadline = new OperationDeadline(bootDiagnosticTimeoutMs);
    signal.throwIfAborted();
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
        { deadline, signal },
      );
      probe = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    } catch (error) {
      probe = getErrorMessage(error);
    }

    this.tracker.ensureActive(app.id);
    signal.throwIfAborted();
    let containerLogs: string;
    try {
      deadline.throwIfExpired();
      containerLogs = await this.lifecycle.getContainerLogs(
        app.containerId,
        200,
        { deadline, signal },
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
