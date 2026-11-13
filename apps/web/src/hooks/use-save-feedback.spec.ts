import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSaveFeedback } from './use-save-feedback'

afterEach(() => vi.useRealTimers())

describe('useSaveFeedback', () => {
  it('only confirms the saved draft, expires, and starts a fresh interval on another save', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSaveFeedback('draft'))
    expect(result.current.saved).toBe(false)
    act(() => result.current.confirmSaved('draft'))
    expect(result.current.saved).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => result.current.confirmSaved('draft'))
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.saved).toBe(true)
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(result.current.saved).toBe(false)
  })

  it('clears confirmation on edits and does not replay it after undo or revalidation', () => {
    const { result, rerender } = renderHook(({ draft }) => useSaveFeedback(draft), { initialProps: { draft: 'saved' } })
    act(() => result.current.confirmSaved('saved'))
    rerender({ draft: 'edited' })
    expect(result.current.saved).toBe(false)
    rerender({ draft: 'saved' })
    expect(result.current.saved).toBe(false)
    act(() => result.current.confirmSaved('stale request'))
    expect(result.current.saved).toBe(false)
  })

  it('clears the timer when a new request starts or the editor unmounts', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useSaveFeedback('draft'))
    act(() => result.current.confirmSaved('draft'))
    act(() => result.current.resetSaveFeedback())
    expect(result.current.saved).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    act(() => result.current.confirmSaved('draft'))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
