const redroidViewerStartupGracePeriodMs = 45_000
export const redroidViewerRefreshIntervalMs = 3_000

const timestamp = (value: number | string | null) =>
  typeof value === 'string' ? Date.parse(value) : (value ?? Number.NaN)

export const getViewerStartupDeadline = (
  lastStartedAt: number | string | null,
  provisioningCompletedAt: number | string | null
) => {
  const startedAtMs = timestamp(lastStartedAt)
  if (!Number.isFinite(startedAtMs)) return null

  const completedAtMs = timestamp(provisioningCompletedAt)
  const readyAtMs = completedAtMs >= startedAtMs ? completedAtMs : startedAtMs
  return new Date(readyAtMs + redroidViewerStartupGracePeriodMs)
}
