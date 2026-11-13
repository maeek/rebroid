import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { useStartupFirstFrame } from './use-startup-first-frame'

const app = { ...previewApp, containerId: 'runtime', provisioningStartedAt: new Date('2026-11-13T00:00:00Z') }
beforeEach(() => sessionStorage.clear())

it('separates delayed viewer opening from viewer setup and keeps the first completed measurement', () => {
  const { result, unmount } = renderHook(() => useStartupFirstFrame(app))
  const requestAt = app.provisioningStartedAt.getTime() + 40_000
  const first = { connectAt: requestAt + 600, presentedAt: requestAt + 2_500 }
  act(() => result.current.recordFirstFrame(first, requestAt))
  act(() =>
    result.current.recordFirstFrame({ connectAt: requestAt + 5_000, presentedAt: requestAt + 6_000 }, requestAt)
  )
  expect(result.current.firstFrameAt).toBe(first.presentedAt)
  expect(result.current.viewerStartup).toEqual({ requestToConnectMs: 600, connectToFrameMs: 1_900 })
  unmount()
  const view = renderHook(() => useStartupFirstFrame(app))
  expect(view.result.current.viewerStartup).toEqual({ requestToConnectMs: 600, connectToFrameMs: 1_900 })
})

it('retains the first presentation across reconnects and remounts but resets for a new startup', () => {
  const { result, unmount } = renderHook(() => useStartupFirstFrame(app))
  act(() => result.current.recordFirstFrame())
  const first = result.current.firstFrameAt
  expect(first).toBeTypeOf('number')
  act(() => result.current.recordFirstFrame())
  expect(result.current.firstFrameAt).toBe(first)
  unmount()
  const view = renderHook(({ current }) => useStartupFirstFrame(current), { initialProps: { current: app } })
  expect(view.result.current.firstFrameAt).toBe(first)
  view.rerender({ current: { ...app, provisioningStartedAt: new Date('2026-11-14T00:00:00Z') } })
  expect(view.result.current.firstFrameAt).toBeUndefined()
})
it('records in memory when storage is unavailable', () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('disabled')
  })
  try {
    const { result } = renderHook(() => useStartupFirstFrame(app))
    act(() => result.current.recordFirstFrame())
    expect(result.current.firstFrameAt).toBeTypeOf('number')
  } finally {
    storage.mockRestore()
  }
})
