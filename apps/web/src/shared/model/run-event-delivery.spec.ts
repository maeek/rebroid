import { afterEach, expect, it, vi } from 'vitest'
import { getBff, sendBff } from '@/lib/http/bff'
import { replayTerminalRunEvents, subscribeToRunEvents } from './run-event-delivery'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn(), sendBff: vi.fn() }))

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
  const page = (events: AutomationRunEvent[]) => ({ events, nextAfter: null })
  vi.mocked(sendBff).mockResolvedValue({ streamUrl: 'wss://example.test/events' })
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
    expect(vi.mocked(sendBff).mock.calls).toEqual([
      [`/api/bff/automations/runs/${runId}/events?after=1`, {}, 'POST', expect.any(AbortSignal)],
      [`/api/bff/automations/runs/${runId}/events?after=2`, {}, 'POST', expect.any(AbortSignal)]
    ])
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

it('follows short history pages through the terminal event without requesting a socket token', async () => {
  const progress = event(7, 'step.progress')
  const finished = event(8, 'run.completed')
  vi.mocked(getBff)
    .mockResolvedValueOnce({ events: [progress], nextAfter: progress.sequence })
    .mockResolvedValueOnce({ events: [finished], nextAfter: null })
  const onEvents = vi.fn()

  await replayTerminalRunEvents({ runId, after: 6, onEvents, isCurrent: () => true })

  expect(onEvents.mock.calls).toEqual([[[progress]], [[finished]]])
  expect(getBff).toHaveBeenLastCalledWith(`/api/bff/automations/runs/${runId}/events?after=7`, undefined)
  expect(sendBff).not.toHaveBeenCalled()
})

it('aborts the pending socket-token request when a subscription closes', async () => {
  vi.mocked(getBff).mockResolvedValue({ events: [], nextAfter: null })
  const entered = Promise.withResolvers<AbortSignal>()
  const reply = Promise.withResolvers<{ streamUrl: string }>()
  vi.mocked(sendBff).mockImplementationOnce((_url, _body, _method, signal) => {
    entered.resolve(signal!)
    return reply.promise
  })
  const socket = vi.fn()
  vi.stubGlobal('WebSocket', socket)
  const close = subscribeToRunEvents({ runId, onEvents: vi.fn() })
  const signal = await entered.promise
  close()
  expect(signal.aborted).toBe(true)
  reply.resolve({ streamUrl: 'wss://example.test/events' })
  await reply.promise
  expect(socket).not.toHaveBeenCalled()
})
