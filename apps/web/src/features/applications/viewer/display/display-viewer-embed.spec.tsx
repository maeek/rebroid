import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { defaultViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { DisplayViewerEmbed } from './display-viewer-embed'

vi.mock('@/server/orchestrator/applications/actions/runtime/viewer-actions', () => ({
  getScrcpySessionAction: vi.fn()
}))
vi.mock('./display-viewer-shell/display-viewer-shell', () => ({ DisplayViewerShell: () => null }))

it('keeps the same streaming settings trigger when opening the main display fails', async () => {
  vi.mocked(getScrcpySessionAction).mockRejectedValueOnce(new Error('Sidecar unreachable'))
  render(
    <DisplayViewerEmbed
      app={{ ...previewApp, status: 'running' }}
      viewerSettings={defaultViewerSettings}
      canControlViewer
      canCaptureScreenshot
      streamingSettings={<button type='button'>Streaming settings</button>}
    />
  )

  expect(screen.getByText('Starting live display')).toBeVisible()
  const settings = screen.getByRole('button', { name: 'Streaming settings' })
  expect(settings).toBeVisible()
  expect(await screen.findByText('Viewer unavailable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Streaming settings' })).toBe(settings)
  expect(settings).toBeVisible()
})

it('stops opening sessions once the Android startup deadline is reached', async () => {
  vi.useFakeTimers()
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockClear().mockRejectedValue(new Error('Sidecar unreachable'))
  try {
    const { unmount } = render(
      <DisplayViewerEmbed
        app={{ ...previewApp, status: 'running', lastStartedAt: new Date(Date.now() - 40_000) }}
        viewerSettings={defaultViewerSettings}
        canControlViewer
        canCaptureScreenshot
      />
    )

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(openSession).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(openSession).toHaveBeenCalledTimes(2)
    await act(() => vi.advanceTimersByTimeAsync(12_000))
    expect(openSession).toHaveBeenCalledTimes(2)
    unmount()
  } finally {
    openSession.mockReset()
    vi.useRealTimers()
  }
})

it('drops a scheduled startup retry when the tab resumes after the deadline', async () => {
  vi.useFakeTimers()
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockClear().mockRejectedValue(new Error('Sidecar unreachable'))
  try {
    const { unmount } = render(
      <DisplayViewerEmbed
        app={{ ...previewApp, status: 'running', lastStartedAt: new Date() }}
        viewerSettings={defaultViewerSettings}
        canControlViewer
        canCaptureScreenshot
      />
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    vi.setSystemTime(Date.now() + 60_000)
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(openSession).toHaveBeenCalledTimes(1)
    unmount()
  } finally {
    openSession.mockReset()
    vi.useRealTimers()
  }
})
