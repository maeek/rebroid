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
