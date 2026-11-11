import { afterEach, expect, it, vi } from 'vitest'
import { getBff } from '@/lib/http/bff'
import { subscribeToRunEvents } from './run-event-delivery'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

const runId = 'run-1'
const event = (sequence: number, type: AutomationRunEvent['type']): AutomationRunEvent => ({
  id: `event-${sequence}`,
  runId,
  ownerUserId: 'owner',
  sequence,
  type,
  stepId: null,
  parentStepId: null,
  message: type,
  data: {},
  createdAt: '2026-01-01T00:00:00.000Z'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('replays from the last delivered event, retries a failed read and closes on the terminal event', async () => {
  vi.useFakeTimers()
  const connections: FakeSocket[] = []
  class FakeSocket {
    onclose?: () => void
    onmessage?: (message: { data: string }) => void
    closed = false

    constructor() {
      connections.push(this)
    }

    close() {
      this.closed = true
      this.onclose?.()
    }

    emit(value: AutomationRunEvent) {
      this.onmessage?.({ data: JSON.stringify({ type: 'event', event: value }) })
    }
  }
  vi.stubGlobal('WebSocket', FakeSocket)

  const started = event(1, 'run.started')
  const progress = event(2, 'step.progress')
  const finished = event(3, 'run.completed')
  const page = (events: AutomationRunEvent[]) => ({ events, hasMore: false, streamUrl: 'wss://example.test/events' })
  vi.mocked(getBff)
    .mockResolvedValueOnce(page([started]))
    .mockRejectedValueOnce(new Error('temporarily unavailable'))
    .mockResolvedValueOnce(page([progress]))
  const received: AutomationRunEvent[] = []
  const onError = vi.fn()
  const stop = subscribeToRunEvents({ runId, onError, onEvents: events => received.push(...events) })

  try {
    await vi.advanceTimersByTimeAsync(0)
    const first = connections[0]
    first.emit(started)
    first.onmessage?.({ data: 'malformed' })
    first.emit(progress)
    first.close()
    first.emit(finished)

    await vi.advanceTimersByTimeAsync(3000)
    expect(getBff).toHaveBeenNthCalledWith(
      3,
      `/api/bff/automations/runs/${runId}/events?after=2`,
      expect.any(AbortSignal)
    )
    expect(onError.mock.calls).toEqual([['invalid-event'], ['unavailable']])
    expect(received).toEqual([started, progress])
    expect(connections).toHaveLength(2)

    const replacement = connections[1]
    replacement.emit(finished)
    expect(replacement.closed).toBe(true)
    await vi.advanceTimersByTimeAsync(3000)
    expect(received).toEqual([started, progress, finished])
    expect(getBff).toHaveBeenCalledTimes(3)
  } finally {
    stop()
  }
})
