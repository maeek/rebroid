import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { defaultViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { DisplayViewerEmbed } from './display-viewer-embed'

vi.mock('@/server/orchestrator/applications/actions/runtime/viewer-actions', () => ({
  getScrcpySessionAction: vi.fn()
}))
vi.mock('./display-viewer-shell/display-viewer-shell', () => ({ DisplayViewerShell: () => null }))

it('keeps the device frame and settings when a session is unavailable and can retry in place', async () => {
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession
    .mockResolvedValueOnce({
      applicationId: previewApp.id,
      transport: 'websocket',
      udid: 'adb:5555',
      proxyRemote: 'tcp:8886',
      player: 'webcodecs',
      viewerServiceConfigured: true,
      viewerTargetConnected: true,
      viewerMessage: null,
      viewerError: null,
      adbHost: 'adb',
      adbPort: 5555,
      displaySession: null
    })
    .mockRejectedValueOnce(new Error('Sidecar unreachable'))
  render(
    <DisplayViewerEmbed
      app={{ ...previewApp, status: 'running' }}
      viewerSettings={defaultViewerSettings}
      canControlViewer
      canCaptureScreenshot
      streamingSettings={<button type='button'>Streaming settings</button>}
    />
  )

  const frame = screen.getByRole('region', { name: 'Android display' })
  const display = within(frame)
  expect(display.getByText('Starting live display')).toBeVisible()
  const settings = display.getByRole('button', { name: 'Streaming settings' })
  expect(settings).toBeVisible()
  const aspectRatio = frame.style.aspectRatio
  expect(aspectRatio).toBeTruthy()
  const error = await display.findByRole('alert')
  expect(error).toHaveTextContent('Viewer unavailable')
  expect(frame.style.aspectRatio).toBe(aspectRatio)
  expect(display.getByRole('button', { name: 'Streaming settings' })).toBe(settings)
  expect(settings).toBeVisible()

  fireEvent.click(display.getByRole('button', { name: 'Try again' }))
  expect(display.getByText('Starting live display')).toBeVisible()
  expect(openSession).toHaveBeenNthCalledWith(2, previewApp.id)
  expect(await display.findByText('Sidecar unreachable')).toBeVisible()
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
