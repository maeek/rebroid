import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DisplayViewerProvider } from '../display-viewer-context'
import { SurfacePanel } from './surface-panel'
import type { DisplayViewerStreamStatus } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

const { refreshSurfaces } = vi.hoisted(() => ({ refreshSurfaces: vi.fn() }))
vi.mock('../hooks/use-display-viewer-actions', () => ({ useDisplayViewerActions: () => ({ refreshSurfaces }) }))
vi.mock('../hooks/use-fullscreen-state', () => ({
  useFullscreenState: () => ({ fullscreen: false, fullscreenElement: null })
}))
vi.mock('./surface-chrome', () => ({ SurfaceChrome: () => null }))
vi.mock('../../viewer-control-bar/viewer-control-bar', () => ({ ViewerControlBar: () => null }))
vi.mock('../../display-viewer-frame', () => ({
  DisplayViewerFrame: ({ onStreamStatus }: { onStreamStatus: (status: DisplayViewerStreamStatus) => void }) => (
    <button
      type='button'
      onClick={() =>
        onStreamStatus({
          code: 'stream-error',
          severity: 'error',
          blocking: true,
          message: 'WebRTC stopped after 3 recovery attempts: NetworkError when attempting to fetch resource',
          transport: 'webrtc'
        })
      }
    >
      Report terminal failure
    </button>
  )
}))

it('offers an in-place retry with pending feedback and replaces only the failed browser consumer after refresh', () => {
  const surface: DisplayViewerSurface = {
    id: 'main',
    surfaceId: 'main',
    sessionId: 'same-session',
    kind: 'main',
    name: 'Main display',
    src: '/viewer?sessionId=same-session',
    popoutUrl: '/app/viewer',
    displaySize: { width: 1080, height: 2340 }
  }
  const viewer = (surfaceRefreshVersion: number) => (
    <DisplayViewerProvider
      value={{
        applicationId: 'app',
        surfaces: [surface],
        surfaceRefreshVersion,
        canCaptureScreenshot: false,
        canControl: false,
        controlsEnabled: false,
        initialKeyboardCaptureEnabled: false
      }}
    >
      <SurfacePanel
        surface={surface}
        showName={false}
      />
    </DisplayViewerProvider>
  )
  const { rerender } = render(viewer(1))
  const failedConsumer = screen.getByRole('button', { name: 'Report terminal failure' })
  fireEvent.click(failedConsumer)
  expect(screen.getByRole('alert')).toHaveTextContent('Live display paused')
  fireEvent.click(screen.getByRole('button', { name: 'Retry display' }))
  const retry = screen.getByRole('button', { name: 'Reopening display…' })
  expect(retry).toBeDisabled()
  expect(retry).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(retry)
  expect(refreshSurfaces).toHaveBeenCalledTimes(1)
  expect(failedConsumer).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Report terminal failure' })).not.toBeInTheDocument()

  rerender(viewer(2))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Report terminal failure' })).not.toBe(failedConsumer)
})
