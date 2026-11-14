import type { DockerMetricsSnapshot } from '@/shared/contracts/diagnostics'

export interface HistorySample {
  collectedAt: string
  timestamp: string
  read: number
  mutation: number
  long: number
  queued: number
  retries: number | null
  errors: number | null
  timeouts: number | null
  slow: number | null
  counters: DockerMetricsSnapshot['totals']
}

type Counter = 'retries' | 'errors' | 'timeouts' | 'slow'
const counters: Counter[] = ['retries', 'errors', 'timeouts', 'slow']

export const appendDockerMetricsHistory = (current: HistorySample[], data: DockerMetricsSnapshot): HistorySample[] => {
  const previous = current.at(-1)
  if (previous && Date.parse(previous.collectedAt) >= Date.parse(data.collectedAt)) return current
  const reset =
    previous &&
    (data.totals.success < previous.counters.success ||
      counters.some(counter => data.totals[counter] < previous.counters[counter]))
  const difference = (counter: Counter) =>
    previous && !reset ? data.totals[counter] - previous.counters[counter] : null
  const sample: HistorySample = {
    collectedAt: data.collectedAt,
    timestamp: new Date(data.collectedAt).toLocaleTimeString(),
    read: data.inFlight.read,
    mutation: data.inFlight.mutation,
    long: data.inFlight.long,
    queued: data.queued.read + data.queued.mutation + data.queued.long,
    retries: difference('retries'),
    errors: difference('errors'),
    timeouts: difference('timeouts'),
    slow: difference('slow'),
    counters: data.totals
  }
  return [...current, sample].slice(-60)
}
