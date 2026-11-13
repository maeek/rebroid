import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { useStartupFirstFrame } from './use-startup-first-frame'

const app = { ...previewApp, containerId: 'runtime', provisioningStartedAt: new Date('2026-11-13T00:00:00Z') }
beforeEach(() => sessionStorage.clear())
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
