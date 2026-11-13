import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useDisplayViewerRetry } from './use-display-viewer-retry'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

const surface = { id: 'main', sessionId: 'same-session', kind: 'main' } as DisplayViewerSurface

it('waits for an authorized refresh and remounts the failed consumer even when its session ID is unchanged', () => {
  const refreshSurfaces = vi.fn()
  const clearStatus = vi.fn()
  const { result, rerender } = renderHook(
    ({ surfaces, surfaceRefreshVersion }) =>
      useDisplayViewerRetry({ surfaces, surfaceRefreshVersion, refreshSurfaces, clearStatus }),
    { initialProps: { surfaces: [surface], surfaceRefreshVersion: 1 } }
  )

  act(() => {
    result.current.retrySurface('main')
    result.current.retrySurface('main')
  })
  expect(refreshSurfaces).toHaveBeenCalledTimes(1)
  expect(result.current.retryingSurfaceId).toBe('main')
  expect(result.current.frameGenerations.main).toBeUndefined()

  // Settings changes can rebuild the surface array without renewing a grant.
  rerender({ surfaces: [{ ...surface, src: '/viewer?sound=0' }], surfaceRefreshVersion: 1 })
  expect(result.current.retryingSurfaceId).toBe('main')
  expect(clearStatus).not.toHaveBeenCalled()

  rerender({ surfaces: [{ ...surface }], surfaceRefreshVersion: 2 })
  expect(result.current.retryingSurfaceId).toBeNull()
  expect(result.current.frameGenerations.main).toBe(1)
  expect(clearStatus).toHaveBeenCalledWith('main')
})

it('ends a failed refresh without remounting the old grant and permits another manual attempt', () => {
  vi.useFakeTimers()
  try {
    const refreshSurfaces = vi.fn()
    const clearStatus = vi.fn()
    const surfaces = [surface]
    const { result, rerender, unmount } = renderHook(
      ({ surfaceRefreshVersion }) =>
        useDisplayViewerRetry({ surfaces, surfaceRefreshVersion, refreshSurfaces, clearStatus }),
      { initialProps: { surfaceRefreshVersion: 1 } }
    )
    act(() => result.current.retrySurface('main'))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current.retryingSurfaceId).toBeNull()
    expect(result.current.retryError?.message).toContain('could not be reopened')
    expect(result.current.frameGenerations.main).toBeUndefined()
    expect(clearStatus).not.toHaveBeenCalled()

    // A late response to the expired attempt must not revive the consumer.
    rerender({ surfaceRefreshVersion: 2 })
    expect(result.current.frameGenerations.main).toBeUndefined()
    act(() => result.current.retrySurface('main'))
    expect(refreshSurfaces).toHaveBeenCalledTimes(2)
    expect(result.current.retryError).toBeNull()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

it('refreshes an immersive viewer through its new server-provided surface snapshot', () => {
  const clearStatus = vi.fn()
  const { result, rerender } = renderHook(
    ({ surfaces }) => useDisplayViewerRetry({ surfaces, refreshSurfaces: vi.fn(), clearStatus }),
    { initialProps: { surfaces: [surface] } }
  )
  act(() => result.current.retrySurface('main'))
  rerender({ surfaces: [{ ...surface }] })
  expect(result.current.frameGenerations.main).toBe(1)
  expect(clearStatus).toHaveBeenCalledWith('main')
})
