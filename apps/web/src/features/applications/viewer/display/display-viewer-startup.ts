const redroidViewerStartupGracePeriodMs = 45_000
export const redroidViewerRefreshIntervalMs = 3_000

export const getViewerStartupDeadline = (lastStartedAt: number | string | null) => {
  if (lastStartedAt === null) return null

  const startedAtMs = typeof lastStartedAt === 'number' ? lastStartedAt : Date.parse(lastStartedAt)
  if (!Number.isFinite(startedAtMs)) return null

  return new Date(startedAtMs + redroidViewerStartupGracePeriodMs)
}
