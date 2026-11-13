import { useState, type Dispatch, type SetStateAction } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { defaultViewerSettings, type ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import { AppViewerStreamingSettings } from './app-viewer-streaming-settings'
import { useApplicationViewerApp } from './application-viewer-context'
import type { ObservedStreamIssue } from './viewer-stream-issue'

vi.mock('./application-viewer-context', () => ({ useApplicationViewerApp: vi.fn() }))
vi.mock('@/shared/model/features/feature-flags-context', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => true })
}))

const openSettings = (streamIssue?: ObservedStreamIssue) => {
  const apply = vi.fn<Dispatch<SetStateAction<ViewerSettings>>>()
  vi.mocked(useApplicationViewerApp).mockImplementation(() => {
    const [viewerSettings, setViewerSettings] = useState(defaultViewerSettings)
    return {
      viewerSettings,
      viewerStreamMetrics: {},
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
  fireEvent.click(screen.getByRole('button', { name: 'Streaming settings' }))
  return apply
}

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

afterEach(() => vi.useRealTimers())

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
