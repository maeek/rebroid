import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { defaultViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { getScrcpySessionAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { DisplayViewerEmbed } from './display-viewer-embed'
import type { ScrcpySession } from '@/shared/contracts/application'

vi.mock('@/server/orchestrator/applications/actions/runtime/viewer-actions', () => ({
  getScrcpySessionAction: vi.fn()
}))
vi.mock('./display-viewer-shell/display-viewer-shell', () => ({ DisplayViewerShell: () => null }))
vi.mock('@/features/applications/viewer/mini-player/pinned-viewer-context', () => ({
  usePinnedViewer: vi.fn(() => null)
}))

const sessionWithoutDisplay: ScrcpySession = {
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
}

const unavailable = actionError({ code: 'upstream_unavailable', message: 'Sidecar unreachable' })

it('opens the embedded display session once when an initially hidden tab becomes visible', async () => {
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockReset().mockResolvedValue(actionOk(sessionWithoutDisplay))
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  const view = render(
    <DisplayViewerEmbed
      app={{ ...previewApp, status: 'running' }}
      viewerSettings={defaultViewerSettings}
      canControlViewer
      canCaptureScreenshot
    />
  )
  try {
    expect(openSession).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    expect(openSession).toHaveBeenCalledExactlyOnceWith(previewApp.id)
  } finally {
    view.unmount()
    visibility.mockRestore()
    openSession.mockReset()
  }
})

it('keeps the device frame and settings when a session is unavailable and can retry in place', async () => {
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockResolvedValueOnce(actionOk(sessionWithoutDisplay)).mockResolvedValueOnce(unavailable)
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

it('retries after a long boot and stops when the same runtime’s Ready deadline is reached', async () => {
  vi.useFakeTimers()
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockReset().mockResolvedValue(unavailable)
  try {
    const { unmount } = render(
      <DisplayViewerEmbed
        app={{
          ...previewApp,
          status: 'running',
          lifecycleStage: 'ready',
          lastStartedAt: new Date(Date.now() - 90_000),
          provisioningCompletedAt: new Date(Date.now() - 40_000)
        }}
        viewerSettings={defaultViewerSettings}
        canControlViewer
        canCaptureScreenshot
      />
    )

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Starting live display')).toBeVisible()
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(openSession).toHaveBeenCalledTimes(2)
    await act(() => vi.advanceTimersByTimeAsync(12_000))
    expect(openSession).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Sidecar unreachable')).toBeVisible()
    unmount()
  } finally {
    openSession.mockReset()
    vi.useRealTimers()
  }
})

it('drops a scheduled startup retry when the tab resumes after the deadline', async () => {
  vi.useFakeTimers()
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockReset().mockResolvedValue(unavailable)
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

it('surfaces a permanent session failure during the startup window', async () => {
  vi.useFakeTimers()
  const openSession = vi.mocked(getScrcpySessionAction)
  openSession.mockReset().mockResolvedValue(actionError({ code: 'forbidden', message: 'Viewer access was revoked.' }))
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
    expect(screen.getByText('Viewer access was revoked.')).toBeVisible()
    await act(() => vi.advanceTimersByTimeAsync(9_000))
    expect(openSession).toHaveBeenCalledTimes(1)
    unmount()
  } finally {
    openSession.mockReset()
    vi.useRealTimers()
  }
})
