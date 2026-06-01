import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react'
import { useVisibilityAwareInterval } from './use-visibility-aware-interval'

describe('useVisibilityAwareInterval', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not overlap task executions', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const task = jest.fn<() => Promise<void>>().mockReturnValue(gate)

    renderHook(() =>
      useVisibilityAwareInterval({
        immediate: true,
        intervalMs: 1000,
        task
      })
    )

    expect(task).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(task).toHaveBeenCalledTimes(1)

    await act(async () => {
      release()
      await gate
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('waits until the page is visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    })
    const task = jest.fn<() => void>()

    renderHook(() =>
      useVisibilityAwareInterval({
        immediate: true,
        intervalMs: 1000,
        task
      })
    )

    act(() => {
      jest.advanceTimersByTime(3000)
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
