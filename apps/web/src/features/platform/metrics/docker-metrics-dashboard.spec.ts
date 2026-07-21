import { describe, expect, it } from 'vitest'
import { appendDockerMetricsHistory } from './docker-metrics-history'
import type { DockerMetricsSnapshot } from '@/shared/contracts/diagnostics'

const snapshot = (index: number): DockerMetricsSnapshot => ({
  collectedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
  transport: 'local-socket',
  limits: {
    maxConcurrentReads: 8,
    maxConcurrentLongOperations: 4,
    slowRequestWarningMs: 5000,
    longOperationTimeoutMs: 1_800_000,
    remoteRequestTimeoutMs: 60_000
  },
  totals: {
    success: index,
    errors: index,
    timeouts: index,
    retries: index,
    slow: index
  },
  inFlight: { read: index, mutation: 0, long: 0 },
  queued: { read: 0, mutation: 0, long: index },
  operations: [],
  events: []
})

describe('appendDockerMetricsHistory', () => {
  it('keeps a rolling five-minute history with one sample per snapshot', () => {
    const history = Array.from({ length: 61 }, (_, index) => snapshot(index)).reduce(appendDockerMetricsHistory, [])
    const unchanged = appendDockerMetricsHistory(history, snapshot(60))

    expect(history).toHaveLength(60)
    expect(history[0]?.collectedAt).toBe(snapshot(1).collectedAt)
    expect(history.at(-1)).toMatchObject({
      collectedAt: snapshot(60).collectedAt,
      read: 60,
      queued: 60,
      retries: 60,
      errors: 120,
      slow: 60
    })
    expect(unchanged).toBe(history)
  })
})
