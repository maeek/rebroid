import type { DockerMetricsSnapshot } from '@/server/orchestrator/diagnostics/types'

export interface HistorySample {
  collectedAt: string
  timestamp: string
  read: number
  mutation: number
  long: number
  queued: number
  retries: number
  errors: number
  slow: number
}

export const appendDockerMetricsHistory = (current: HistorySample[], data: DockerMetricsSnapshot): HistorySample[] => {
  if (current.at(-1)?.collectedAt === data.collectedAt) return current
  const sample: HistorySample = {
    collectedAt: data.collectedAt,
    timestamp: new Date(data.collectedAt).toLocaleTimeString(),
    read: data.inFlight.read,
    mutation: data.inFlight.mutation,
    long: data.inFlight.long,
    queued: data.queued.read + data.queued.mutation + data.queued.long,
    retries: data.totals.retries,
    errors: data.totals.errors + data.totals.timeouts,
    slow: data.totals.slow
  }
  return [...current, sample].slice(-60)
}
