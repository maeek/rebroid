import type { Logger } from '@nestjs/common';
import {
  ContainerCommandFailedException,
  type ContainerCommandResult,
  type ContainerRuntimeState,
} from '../../../docker/docker.types';
import { parseAndroidBootReadiness } from '../utils/android-apps-android-provisioning.utils';
import type { BootPropertyObservation } from '../utils/android-boot-observation';
import type { AndroidBootOperationTimer } from '../utils/android-boot-operation-timer';

type ProbeIdentity = {
  applicationId: string;
  containerId: string;
  reservationId: string | null;
  bootObservationId: string;
};

type SettledProbe = {
  observationStartedAt: number;
  probeResult: PromiseSettledResult<ContainerCommandResult | undefined>;
  propertyTimer: AndroidBootOperationTimer | undefined;
  runtime: PromiseSettledResult<ContainerRuntimeState>;
  runtimeTimer: AndroidBootOperationTimer;
  guestShellObserved: boolean;
  cancelled: boolean;
};

function initialShellUnavailable(error: unknown): boolean {
  if (!(error instanceof ContainerCommandFailedException)) return false;
  const { command, exitCode, stderr } = error.details;
  return (
    exitCode === 255 &&
    command[0] === 'sh' &&
    command[1] === '-lc' &&
    stderr?.trim() === 'exec /bin/sh: no such file or directory'
  );
}

export class AndroidBootProbeReporter {
  private sequence = 0;
  private previousSettledAt: number;
  private guestUnavailableAt?: number;
  private guestUnavailableObservations = 0;

  constructor(
    private readonly logger: Logger,
    private readonly bootStartedAt: number,
    private readonly identity: ProbeIdentity,
  ) {
    this.previousSettledAt = bootStartedAt;
  }

  record({
    observationStartedAt,
    probeResult,
    propertyTimer,
    runtime,
    runtimeTimer,
    guestShellObserved,
    cancelled,
  }: SettledProbe): BootPropertyObservation {
    const output =
      probeResult.status === 'fulfilled' ? probeResult.value : undefined;
    const readiness = output && parseAndroidBootReadiness(output.stdout);
    const settledAt = performance.now();
    const timings = propertyTimer?.snapshot();
    const initialGuestShellUnavailable =
      !guestShellObserved &&
      probeResult.status === 'rejected' &&
      initialShellUnavailable(probeResult.reason);
    const sequence = ++this.sequence;
    this.logger.log({
      event: 'android_boot_probe',
      ...this.identity,
      sequence,
      observedAt: new Date().toISOString(),
      elapsedMs: Math.round(settledAt - this.bootStartedAt),
      waitSincePreviousObservationMs: Math.round(
        observationStartedAt - this.previousSettledAt,
      ),
      observationMs: Math.round(settledAt - observationStartedAt),
      properties: timings ?? { outcome: 'skipped_backoff' },
      runtime: runtimeTimer.snapshot(),
      propertyReady: readiness?.ready ?? null,
      runtimeRunning:
        runtime.status === 'fulfilled'
          ? runtime.value.exists && runtime.value.running
          : null,
      initialGuestShellUnavailable,
      cancelled,
    });
    this.previousSettledAt = settledAt;
    if (probeResult.status === 'rejected') {
      return {
        status: 'failed',
        error: probeResult.reason,
        initialGuestShellUnavailable,
      };
    }
    if (!output || !readiness || !timings) return { status: 'skipped' };
    return {
      status: 'observed',
      readiness,
      stderr: output.stderr,
      sample: {
        sequence,
        dispatchedAfterMs: timings.dispatchedAfterMs,
        settledAfterMs: timings.settledAfterMs,
      },
    };
  }

  guestShellUnavailable() {
    this.guestUnavailableObservations += 1;
    if (this.guestUnavailableAt !== undefined) return;
    this.guestUnavailableAt = performance.now();
    this.logger.log({
      event: 'android_guest_shell_unavailable',
      applicationId: this.identity.applicationId,
      containerId: this.identity.containerId,
      observedAt: new Date().toISOString(),
    });
  }

  guestShellAvailable() {
    if (this.guestUnavailableAt === undefined) return;
    this.logger.log({
      event: 'android_guest_shell_available',
      applicationId: this.identity.applicationId,
      containerId: this.identity.containerId,
      observedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - this.guestUnavailableAt),
      unavailableObservations: this.guestUnavailableObservations,
    });
    this.guestUnavailableAt = undefined;
  }
}
