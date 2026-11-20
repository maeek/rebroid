import { getErrorMessage } from '../../../common/error-message';

export const bootCheckIntervalMs = 1_000;
const maxUnchangedBootProbeIntervalMs = 3_000;
const maxConsecutiveObservationFailures = 3;

export type BootPropertySample = {
  sequence: number;
  dispatchedAfterMs: number | null;
  settledAfterMs: number;
};

export type BootPropertyObservation =
  | {
      status: 'observed';
      readiness: { ready: boolean; probe: string };
      stderr: string;
      sample: BootPropertySample;
    }
  | { status: 'failed'; error: unknown; initialGuestShellUnavailable: boolean }
  | { status: 'skipped' };

type BootRuntime = {
  exists: boolean;
  running: boolean;
  startedAt?: string | null;
};

export type BootObservationState = {
  lastProbe: string;
  probeIntervalMs: number;
  runtimeFailures: number;
  propertyFailures: number;
  guestShellObserved: boolean;
};

type BootObservationDecision<Runtime> =
  | { kind: 'runtime-exited'; runtime: Runtime }
  | { kind: 'deadline-expired' }
  | { kind: 'failed'; error: unknown }
  | { kind: 'wait'; state: BootObservationState }
  | {
      kind: 'retry-properties';
      initialGuestShellUnavailable: boolean;
      state: BootObservationState;
    }
  | {
      kind: 'ready' | 'not-ready';
      startedAt?: string | null;
      sample: BootPropertySample;
      state: BootObservationState;
    };

export function decideAndroidBootObservation<Runtime extends BootRuntime>({
  state,
  runtime,
  properties,
  deadlineExpired,
  isRetryableError,
}: {
  state: BootObservationState;
  runtime: PromiseSettledResult<Runtime>;
  properties: BootPropertyObservation;
  deadlineExpired: boolean;
  isRetryableError: (error: unknown) => boolean;
}): BootObservationDecision<Runtime> {
  // A definitive exit still wins if the other probe spent the remaining budget.
  if (
    runtime.status === 'fulfilled' &&
    (!runtime.value.exists || !runtime.value.running)
  ) {
    return { kind: 'runtime-exited', runtime: runtime.value };
  }
  if (deadlineExpired) return { kind: 'deadline-expired' };

  // Ready properties alone cannot establish that the runtime is still running.
  if (runtime.status === 'rejected') {
    const error: unknown = runtime.reason;
    const runtimeFailures = state.runtimeFailures + 1;
    if (
      !isRetryableError(error) ||
      runtimeFailures >= maxConsecutiveObservationFailures
    ) {
      return { kind: 'failed', error };
    }
    return {
      kind: 'wait',
      state: { ...state, runtimeFailures, lastProbe: getErrorMessage(error) },
    };
  }

  const runningState = { ...state, runtimeFailures: 0 };
  if (properties.status === 'skipped') {
    return { kind: 'wait', state: runningState };
  }
  if (properties.status === 'failed') {
    const { error, initialGuestShellUnavailable } = properties;
    // The initial guest shell gets the full boot budget.
    const propertyFailures = initialGuestShellUnavailable
      ? 0
      : state.propertyFailures + 1;
    if (
      !initialGuestShellUnavailable &&
      (!isRetryableError(error) ||
        propertyFailures >= maxConsecutiveObservationFailures)
    ) {
      return { kind: 'failed', error };
    }
    return {
      kind: 'retry-properties',
      initialGuestShellUnavailable,
      state: {
        ...runningState,
        propertyFailures,
        lastProbe: getErrorMessage(error),
        probeIntervalMs: bootCheckIntervalMs,
      },
    };
  }

  const { readiness, stderr, sample } = properties;
  const probe = [readiness.probe, stderr.trim()].filter(Boolean).join(' ');
  return {
    kind: readiness.ready ? 'ready' : 'not-ready',
    startedAt: runtime.value.startedAt,
    sample,
    state: {
      ...runningState,
      guestShellObserved: true,
      propertyFailures: 0,
      lastProbe: probe,
      probeIntervalMs:
        probe === state.lastProbe
          ? Math.min(
              state.probeIntervalMs + bootCheckIntervalMs,
              maxUnchangedBootProbeIntervalMs,
            )
          : bootCheckIntervalMs,
    },
  };
}
