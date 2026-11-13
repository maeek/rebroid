import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useMiniPlayerViewport } from './use-mini-player-viewport'

it('uses the usable page width and follows scrollbar changes without polling', () => {
  let notify: ResizeObserverCallback | undefined
  const disconnect = vi.fn()
  const observe = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback
      }
      observe = observe
      disconnect = disconnect
    }
  )
  const clientWidth = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1100)
  const originalHeight = window.innerHeight
  const { result, unmount } = renderHook(() => useMiniPlayerViewport(true))
  try {
    expect(observe).toHaveBeenCalledWith(document.documentElement)
    expect(result.current.width).toBe(1100)
    clientWidth.mockReturnValue(1085)
    act(() => notify?.([], {} as ResizeObserver))
    expect(result.current.width).toBe(1085)
    window.innerHeight = 360
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.height).toBe(360)
    const snapshot = result.current
    act(() => notify?.([], {} as ResizeObserver))
    expect(result.current).toBe(snapshot)
  } finally {
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    clientWidth.mockRestore()
    window.innerHeight = originalHeight
    vi.unstubAllGlobals()
  }
})
