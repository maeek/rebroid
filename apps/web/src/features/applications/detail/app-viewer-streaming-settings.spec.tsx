import { useState, type Dispatch, type SetStateAction } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStreamingDiagnosticSurfaces } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { defaultViewerSettings, type ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { AppViewerStreamingSettings } from './app-viewer-streaming-settings'
import { useApplicationViewerApp } from './application-viewer-context'
import type { ViewerStreamSample } from './application-viewer-context'
import type { ObservedStreamIssue } from './viewer-stream-issue'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

vi.mock('./application-viewer-context', () => ({ useApplicationViewerApp: vi.fn() }))
vi.mock('@/features/applications/viewer/display/display-viewer-shell/display-viewer-context', () => ({
  useStreamingDiagnosticSurfaces: vi.fn()
}))
vi.mock('@/shared/model/features/feature-flags-context', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => true })
}))

const renderSettings = (
  streamIssue?: ObservedStreamIssue,
  status = 'running',
  samples: Record<string, ViewerStreamSample> = {},
  surfaces?: DisplayViewerSurface[]
) => {
  const apply = vi.fn<Dispatch<SetStateAction<ViewerSettings>>>()
  vi.mocked(useStreamingDiagnosticSurfaces).mockReturnValue(surfaces)
  vi.mocked(useApplicationViewerApp).mockImplementation(() => {
    const [viewerSettings, setViewerSettings] = useState(defaultViewerSettings)
    return {
      app: { status, containerId: 'runtime' },
      viewerSettings,
      viewerStreamMetrics: samples,
      setViewerSettings: next => {
        apply(next)
        setViewerSettings(next)
      }
    } as ReturnType<typeof useApplicationViewerApp>
  })
  render(
    <TooltipProvider>
      <AppViewerStreamingSettings streamIssue={streamIssue} />
    </TooltipProvider>
  )
  return { apply }
}

const openSettings = (streamIssue?: ObservedStreamIssue) => {
  const { apply } = renderSettings(streamIssue)
  fireEvent.click(screen.getByRole('button', { name: 'Streaming settings' }))
  return apply
}

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

afterEach(() => vi.useRealTimers())

it.each(['stopped', 'error', 'running'])('shows the settings label only while the app is inactive (%s)', status => {
  renderSettings(undefined, status)
  const trigger = screen.getByRole('button', { name: 'Streaming settings' })
  expect(trigger).toHaveTextContent(status === 'running' ? /^$/ : /^Streaming settings$/)
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Streaming settings' })).toBeVisible()
})

it('applies only the final bitrate across slider and numeric input changes', () => {
  vi.useFakeTimers()
  const apply = openSettings()
  const slider = screen.getByRole('slider', { name: 'Bitrate range' })
  const input = screen.getByRole('spinbutton', { name: 'Bitrate' })

  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(input).toHaveValue(16.5)
  advance(250)
  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(input).toHaveValue(17)
  advance(250)
  fireEvent.change(input, { target: { value: '' } })
  advance(500)
  expect(apply).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: '8.5' } })
  expect(slider).toHaveAttribute('aria-valuenow', '8.5')
  advance(399)
  expect(apply).not.toHaveBeenCalled()
  advance(1)
  expect(apply).toHaveBeenCalledOnce()
  expect(screen.getByText(/Encoder target 8\.5 Mbps/)).toBeVisible()
})

it('replaces a pending bitrate edit when choosing a preset', () => {
  vi.useFakeTimers()
  const apply = openSettings()
  const input = screen.getByRole('spinbutton', { name: 'Bitrate' })
  fireEvent.change(input, { target: { value: '22' } })
  fireEvent.click(screen.getByRole('combobox', { name: 'Preset' }))
  const balanced = screen.getByRole('option', { name: 'Balanced' })
  fireEvent.pointerDown(balanced, { pointerType: 'mouse' })
  fireEvent.click(balanced)
  expect(input).toHaveValue(3)
  advance(500)
  expect(apply).toHaveBeenCalledOnce()
  expect(input).toHaveValue(3)
})

it('applies a valid pending bitrate even if the sheet closes first', () => {
  vi.useFakeTimers()
  const apply = openSettings()
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Bitrate' }), { target: { value: '12' } })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(apply).not.toHaveBeenCalled()
  advance(400)
  expect(apply).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Streaming settings' }))
  expect(screen.getByRole('spinbutton', { name: 'Bitrate' })).toHaveValue(12)
})

it('shows the last stream issue and its correlation details without live metrics', () => {
  openSettings({
    surfaceId: 'main',
    observedAt: 1_794_573_000_000,
    status: {
      code: 'reconnecting',
      severity: 'warning',
      blocking: false,
      transport: 'websocket',
      message: 'Display WebSocket closed.',
      failureStage: 'socket',
      closeCode: 1011
    }
  })
  expect(screen.getByText('Last streaming issue')).toBeVisible()
  expect(screen.getByText('Display WebSocket closed.')).toBeVisible()
  expect(screen.getByText('1011')).toBeVisible()
  expect(screen.getByText('Main display')).toBeVisible()
})

it('shows the WebRTC attempt ID even if the peer never produced a frame', () => {
  openSettings({
    surfaceId: 'main',
    observedAt: 1_794_573_000_000,
    status: {
      code: 'stream-error',
      severity: 'error',
      blocking: true,
      transport: 'webrtc',
      message: 'WebRTC control channel closed.',
      failureStage: 'control-channel',
      consumerAttemptId: 'attempt-123'
    }
  })
  expect(screen.getByText('WebRTC control channel closed.')).toBeVisible()
  expect(screen.getByText('attempt-123')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Copy Attempt ID' })).toBeInTheDocument()
})

it('defaults to the display with the issue and tracks first, fresh, and stale samples independently', () => {
  vi.useFakeTimers()
  const now = Date.now()
  const sample: DisplayViewerStreamMetrics = {
    version: 4,
    transport: 'websocket',
    renderer: 'chromium-webcodecs',
    presentedFps: 42,
    effectiveProfile: {
      transport: 'websocket',
      codec: 'h264',
      maxSize: 0,
      maxFps: 60,
      bitrate: 1000,
      iFrameInterval: 1,
      audio: false
    },
    collectedAt: now
  }
  const display = (id: string, name: string, kind: DisplayViewerSurface['kind']): DisplayViewerSurface => ({
    id,
    surfaceId: id,
    sessionId: id,
    name,
    kind,
    src: '/',
    popoutUrl: '/',
    displaySize: { width: 1080, height: 720 }
  })
  renderSettings(
    {
      surfaceId: 'virtual',
      observedAt: now,
      status: { code: 'video-stalled', severity: 'warning', blocking: false, message: 'Virtual display stalled.' }
    },
    'running',
    {
      main: { sessionId: 'main', runtimeId: 'runtime', metrics: sample },
      virtual: { sessionId: 'closed-session', runtimeId: 'runtime', metrics: { ...sample, presentedFps: 7 } }
    },
    [display('main', 'Main display', 'main'), display('virtual', 'Inspection display', 'virtual')]
  )
  fireEvent.click(screen.getByRole('button', { name: 'Streaming settings' }))
  const selector = screen.getByRole('combobox', { name: 'Metrics display' })
  expect(selector).toHaveTextContent('Inspection display')
  expect(screen.getByText('Collecting the first sample for this display…')).toBeVisible()
  expect(screen.queryByText('Presented FPS')).toBeNull()
  fireEvent.click(selector)
  const main = screen.getByRole('option', { name: 'Main display' })
  fireEvent.pointerDown(main, { pointerType: 'mouse' })
  fireEvent.click(main)
  expect(selector).toHaveTextContent('Main display')
  expect(screen.getByText('Sample taken')).toBeVisible()
  expect(screen.getByText('42')).toBeVisible()
  advance(5001)
  expect(screen.getByText('Stale sample from')).toBeVisible()
  expect(screen.getByText('42')).toBeVisible()
})
