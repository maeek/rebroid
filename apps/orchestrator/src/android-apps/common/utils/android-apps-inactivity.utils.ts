import type { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';

export type InactivityCandidate = Pick<
  AndroidApplication,
  'id' | 'containerId' | 'lastStartedAt'
>;

type InactivityState = Pick<
  AndroidApplication,
  'inactivityTimeoutSeconds' | 'lastScrcpyActivityAt' | 'lastStartedAt'
>;

/** Uses activity from the current run instead of stale viewer activity from an older run. */
export const latestRuntimeActivity = (
  lastScrcpyActivityAt: Date | null,
  lastStartedAt: Date | null,
) => {
  if (!lastScrcpyActivityAt) {
    return lastStartedAt;
  }
  if (!lastStartedAt) {
    return lastScrcpyActivityAt;
  }

  return lastScrcpyActivityAt > lastStartedAt
    ? lastScrcpyActivityAt
    : lastStartedAt;
};

export const isRuntimeInactive = (app: InactivityState, now: Date) => {
  if (app.inactivityTimeoutSeconds < 0) return false;
  const lastActivity = latestRuntimeActivity(
    app.lastScrcpyActivityAt,
    app.lastStartedAt,
  );
  return (
    lastActivity !== null &&
    now.getTime() - lastActivity.getTime() >=
      app.inactivityTimeoutSeconds * 1000
  );
};

type InactivityRuntime = InactivityCandidate &
  InactivityState &
  Pick<AndroidApplication, 'status'>;

export const isCurrentInactiveRuntime = <T extends InactivityRuntime>(
  app: T | null,
  expected: InactivityCandidate,
  now: Date,
): app is T =>
  app?.status === AndroidApplicationStatus.Running &&
  app.containerId === expected.containerId &&
  app.lastStartedAt?.getTime() === expected.lastStartedAt?.getTime() &&
  isRuntimeInactive(app, now);
