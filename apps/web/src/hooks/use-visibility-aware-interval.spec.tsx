import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisibilityAwareInterval } from './use-visibility-aware-interval'

describe('useVisibilityAwareInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not overlap task executions', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const task = vi.fn<() => Promise<void>>().mockReturnValue(gate)

    renderHook(() =>
      useVisibilityAwareInterval({
        immediate: true,
        intervalMs: 1000,
        task
      })
    )

    expect(task).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(task).toHaveBeenCalledTimes(1)

    await act(async () => {
      release()
      await gate
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('waits until the page is visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    })
    const task = vi.fn<() => void>()

    renderHook(() =>
      useVisibilityAwareInterval({
        immediate: true,
        intervalMs: 1000,
        task
      })
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(task).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(task).toHaveBeenCalledTimes(1)
  })
})
