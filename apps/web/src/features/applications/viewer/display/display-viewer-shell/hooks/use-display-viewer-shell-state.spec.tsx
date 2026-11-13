import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useDisplayViewerShellState } from './use-display-viewer-shell-state'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

vi.mock('./use-display-viewer-actions', () => ({ useDisplayViewerActions: () => ({ refreshSurfaces: vi.fn() }) }))
vi.mock('./use-fullscreen-state', () => ({
  useFullscreenState: () => ({ fullscreen: false, fullscreenElement: null })
}))

it.each(['webrtc', 'websocket'] as const)(
  'records presentation only for the current main display over %s',
  transport => {
    const onFirstFrame = vi.fn()
    const surfaces = [
      { id: 'main', sessionId: 'current', kind: 'main' },
      { id: 'virtual', sessionId: 'virtual-session', kind: 'virtual' }
    ] as DisplayViewerSurface[]
    const { result } = renderHook(() =>
      useDisplayViewerShellState({
        applicationId: 'app',
        surfaces,
        initialKeyboardCaptureEnabled: false,
        onFirstFrame
      })
    )
    const ready = {
      code: 'session-ready',
      severity: 'info',
      blocking: false,
      message: 'Showing video',
      transport,
      startup: { connectAt: 1_000, presentedAt: 1_150 }
    } as const
    act(() => result.current.setSurfaceStreamStatus('main', { ...ready, sessionId: 'retired' }))
    act(() => result.current.setSurfaceStreamStatus('virtual', { ...ready, sessionId: 'virtual-session' }))
    expect(onFirstFrame).not.toHaveBeenCalled()
    act(() => result.current.setSurfaceStreamStatus('main', { ...ready, sessionId: 'current' }))
    expect(onFirstFrame).toHaveBeenCalledTimes(1)
    expect(onFirstFrame).toHaveBeenCalledWith(ready.startup)
  }
)

it.each(['webrtc', 'websocket'] as const)(
  'keeps a terminal %s failure actionable until the current display presents again',
  transport => {
    vi.useFakeTimers()
    try {
      const surfaces = [{ id: 'main', sessionId: 'current', kind: 'main' }] as DisplayViewerSurface[]
      const { result, unmount } = renderHook(() =>
        useDisplayViewerShellState({ applicationId: 'app', surfaces, initialKeyboardCaptureEnabled: false })
      )
      act(() =>
        result.current.setSurfaceStreamStatus('main', {
          code: 'stream-error',
          severity: 'error',
          blocking: true,
          message: 'Stopped after 3 recovery attempts: NetworkError when attempting to fetch resource',
          transport
        })
      )
      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      expect(result.current.streamStatuses.main?.blocking).toBe(true)
      act(() =>
        result.current.setSurfaceStreamStatus('main', {
          code: 'session-ready',
          sessionId: 'current',
          severity: 'info',
          blocking: false,
          message: 'Showing video',
          transport
        })
      )
      expect(result.current.streamStatuses.main).toBeUndefined()
      unmount()
    } finally {
      vi.useRealTimers()
    }
  }
)
