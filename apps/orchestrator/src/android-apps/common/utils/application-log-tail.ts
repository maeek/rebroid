const defaultTailLines = 300;

export const applicationLogMaxBytes = 256 * 1024;

export const normalizeApplicationLogTail = (tail = defaultTailLines) =>
  Number.isFinite(tail)
    ? Math.max(1, Math.min(Math.trunc(tail), 2_000))
    : defaultTailLines;
