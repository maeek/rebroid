import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutomationRunEvents } from './use-automation-run-events'
import { useWorkflowRunUpdates } from './use-workflow-run-updates'
import type { AutomationRunEvent, AutomationRunStatus } from '@/shared/contracts/automation'

vi.mock('./use-automation-run-events', async importOriginal => ({
  ...(await importOriginal<typeof import('./use-automation-run-events')>()),
  useAutomationRunEvents: vi.fn()
}))

const run = { id: 'run', status: 'running' as const }
const event = (sequence: number, type: AutomationRunEvent['type']): AutomationRunEvent => ({
  id: `event-${sequence}`,
  runId: run.id,
  ownerUserId: 'owner',
  sequence,
  type,
  stepId: null,
  parentStepId: null,
  message: type,
  data: {},
  createdAt: '2026-11-20T12:00:00.000Z'
})
const feed = (connected: boolean, events: AutomationRunEvent[] = [], status: AutomationRunStatus = 'running') =>
  vi.mocked(useAutomationRunEvents).mockReturnValue({
    status,
    events,
    connected,
    streamError: null,
    hasLoadedEvents: true
  })

describe('workflow run refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces step events and refreshes again when a terminal event arrives during a read', async () => {
    let finishRead!: () => void
    const reading = new Promise<void>(resolve => {
      finishRead = resolve
    })
    const refresh = vi.fn<() => Promise<void>>().mockReturnValueOnce(reading).mockResolvedValue(undefined)
    feed(true)
    const { rerender, unmount } = renderHook(() => useWorkflowRunUpdates(run, true, refresh))
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(refresh).not.toHaveBeenCalled()

    const completed = event(1, 'step.completed')
    const nextStep = event(2, 'step.completed')
    feed(true, [completed])
    rerender()
    feed(true, [completed, nextStep])
    rerender()
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(refresh).toHaveBeenCalledTimes(1)

    feed(true, [nextStep, event(3, 'run.completed')], 'success')
    rerender()
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(refresh).toHaveBeenCalledTimes(1)
    await act(async () => {
      finishRead()
      await reading
    })
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(refresh).toHaveBeenCalledTimes(2)
    rerender()
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(refresh).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('polls only the run while the connection is down', async () => {
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    feed(false)
    const { rerender, unmount } = renderHook(() => useWorkflowRunUpdates(run, true, refresh))
    await act(() => vi.advanceTimersByTimeAsync(5_150))
    expect(refresh).toHaveBeenCalledTimes(1)
    feed(true)
    rerender()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(refresh).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('retries a failed focused read even while the event stream stays connected', async () => {
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Transient failure'))
      .mockResolvedValue(undefined)
    feed(true, [event(1, 'step.completed')])
    const { unmount } = renderHook(() => useWorkflowRunUpdates(run, true, refresh))
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(refresh).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(5_150))
    expect(refresh).toHaveBeenCalledTimes(2)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(refresh).toHaveBeenCalledTimes(2)
    unmount()
  })
})
