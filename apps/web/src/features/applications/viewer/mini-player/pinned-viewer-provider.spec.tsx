import { useLayoutEffect, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, onTestFinished, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useDesktopViewport } from '@/hooks/use-desktop-viewport'
import { DisplayViewerProvider } from '../display/display-viewer-shell/display-viewer-context'
import { SurfacePanel } from '../display/display-viewer-shell/surface/surface-panel'
import { ViewerControlProvider } from '../display/viewer-control-bar/viewer-control-context'
import { usePinnedViewer, type DockedViewer } from './pinned-viewer-context'
import { PinnedViewerProvider } from './pinned-viewer-provider'

vi.mock('@/hooks/use-desktop-viewport', () => ({ useDesktopViewport: vi.fn() }))
vi.mock('@/features/applications/viewer/display/viewer-activity-keepalive', () => ({
  ViewerActivityKeepalive: () => null
}))
vi.mock('@/features/applications/viewer/display/display-viewer-shell/hooks/use-display-viewer-actions', () => ({
  useDisplayViewerActions: () => ({ refreshSurfaces: vi.fn() })
}))
vi.mock('@/server/orchestrator/applications/actions/runtime/viewer-actions', () => ({
  sendApplicationViewerControlAction: vi.fn()
}))
vi.mock('@/server/orchestrator/applications/actions/runtime/clipboard-actions', () => ({
  getApplicationClipboardAction: vi.fn(),
  setApplicationClipboardAction: vi.fn()
}))

const displaySize = { width: 1080, height: 2340 }
const surface = {
  id: 'main',
  surfaceId: 'main',
  sessionId: 'session-1',
  kind: 'main',
  name: 'Main display',
  src: '/viewer/display?sessionId=session-1&audio=1',
  popoutUrl: '/viewer/apps/app-1',
  displaySize
} as const

const InlineViewer = ({ keyboardCaptureEnabled = false }: { keyboardCaptureEnabled?: boolean }) => {
  const viewer = usePinnedViewer()!
  const { register, unregister } = viewer
  const [registration] = useState(() => Symbol('dock'))
  const [dock, setDock] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!dock) return
    register(registration, {
      appId: 'app-1',
      name: 'Android app',
      runtime: 'runtime-1',
      session: { value: { applicationId: 'app-1' } as DockedViewer['session']['value'], requestAt: 1 },
      element: dock,
      surface,
      frameGeneration: 0,
      displaySize,
      canControl: true,
      canClipboard: true,
      isActive: true,
      keyboardCaptureEnabled,
      onStreamMetrics: vi.fn(),
      onStreamStatus: vi.fn(),
      onRetry: vi.fn(),
      retrying: false,
      retryError: null
    })
    return () => unregister(registration)
  }, [dock, register, unregister, registration, keyboardCaptureEnabled])
  return (
    <>
      <div
        ref={element => {
          if (!element) return
          element.getBoundingClientRect = () => new DOMRect(30, 60, 240, 520)
          setDock(element)
        }}
      />
      <button
        type='button'
        onClick={() => viewer.minimize('app-1')}
      >
        Minimize player
      </button>
      <button
        type='button'
        onClick={() => viewer.restore('app-1')}
      >
        Return to app viewer
      </button>
      <label>
        Search <input />
      </label>
    </>
  )
}

const Console = ({ route = 'viewer', captures = false }: { route?: 'viewer' | 'overview'; captures?: boolean }) => (
  <TooltipProvider>
    <PinnedViewerProvider>
      {route === 'viewer' ? <InlineViewer keyboardCaptureEnabled={captures} /> : <h1>Overview</h1>}
    </PinnedViewerProvider>
  </TooltipProvider>
)

it('keeps the SurfacePanel iframe and window through docking, restore, and fullscreen', () => {
  vi.mocked(useDesktopViewport).mockReturnValue(true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  const rect = vi
    .spyOn(HTMLDivElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(30, 60, 240, 520))
  const changeFullscreen = (element: Element | null) => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element })
    fireEvent(document, new Event('fullscreenchange'))
  }
  const exitFullscreen = vi.fn(() => {
    changeFullscreen(null)
    return Promise.resolve()
  })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen })
  onTestFinished(() => {
    vi.unstubAllGlobals()
    rect.mockRestore()
    Reflect.deleteProperty(document, 'exitFullscreen')
    Reflect.deleteProperty(document, 'fullscreenElement')
  })
  const layout = (showViewer: boolean) => (
    <TooltipProvider>
      <PinnedViewerProvider>
        {showViewer ? (
          <DisplayViewerProvider
            value={{
              applicationId: 'app-1',
              surfaces: [surface],
              dockedSession: {
                name: 'Android app',
                runtime: 'runtime-1',
                session: { value: { applicationId: 'app-1' } as DockedViewer['session']['value'], requestAt: 1 }
              },
              canCaptureScreenshot: false,
              canControl: false,
              controlsEnabled: false,
              initialKeyboardCaptureEnabled: false
            }}
          >
            <ViewerControlProvider>
              <SurfacePanel
                surface={surface}
                showName={false}
              />
            </ViewerControlProvider>
          </DisplayViewerProvider>
        ) : null}
      </PinnedViewerProvider>
    </TooltipProvider>
  )
  const view = render(layout(true))
  const iframe = screen.getByTitle<HTMLIFrameElement>('display viewer')
  const frameWindow = iframe.contentWindow
  const host = screen.getByRole('region', { name: 'Android app display' })
  const requestFullscreen = vi.fn(() => {
    changeFullscreen(host)
    return Promise.resolve()
  })
  host.requestFullscreen = requestFullscreen
  const expectSameFrame = () => {
    expect(screen.getByTitle('display viewer')).toBe(iframe)
    expect(iframe.contentWindow).toBe(frameWindow)
    expect(iframe).toHaveAttribute('src', surface.src)
  }

  fireEvent.keyDown(window, { key: 'i' })
  expect(screen.getByRole('region', { name: 'Android app mini-player' })).toBe(host)
  expectSameFrame()
  view.rerender(layout(false))
  expectSameFrame()
  view.rerender(layout(true))
  fireEvent.click(screen.getByRole('button', { name: 'Restore viewer' }))
  expect(screen.getByRole('region', { name: 'Android app display' })).toBe(host)
  expectSameFrame()

  const fullscreen = screen.getByRole('button', { name: 'Enter fullscreen' })
  fireEvent.click(fullscreen)
  expect(requestFullscreen).toHaveBeenCalledOnce()
  expect(within(host).getByRole('group', { name: 'Fullscreen viewer controls' })).toBeVisible()
  expectSameFrame()
  fireEvent.click(fullscreen)
  expect(exitFullscreen).toHaveBeenCalledOnce()
  expect(within(host).queryByRole('group', { name: 'Fullscreen viewer controls' })).not.toBeInTheDocument()
  expectSameFrame()
})

it('keeps the same iframe through minimize, expand, collapse, navigation and return', () => {
  vi.mocked(useDesktopViewport).mockReturnValue(true)
  const view = render(<Console />)
  const iframe = screen.getByTitle('display viewer')
  const frameSrc = iframe.getAttribute('src')
  fireEvent.click(screen.getByRole('button', { name: 'Minimize player' }))
  const player = screen.getByRole('region', { name: 'Android app mini-player' })
  expect(iframe).toHaveAttribute('data-viewer-compact')
  expect(within(player).queryByRole('group', { name: 'Viewer toolbar' })).not.toBeInTheDocument()

  fireEvent.click(within(player).getByRole('button', { name: 'Expand mini-player' }))
  expect(iframe).not.toHaveAttribute('data-viewer-compact')
  expect(within(player).getByRole('group', { name: 'Viewer toolbar' })).toBeVisible()
  expect(within(player).getByRole('button', { name: 'Device clipboard' })).toBeVisible()
  fireEvent.click(within(player).getByRole('button', { name: 'Collapse mini-player' }))

  view.rerender(<Console route='overview' />)
  expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible()
  expect(screen.getByTitle('display viewer')).toBe(iframe)
  view.rerender(<Console />)
  fireEvent.click(screen.getByRole('button', { name: 'Restore viewer' }))
  expect(screen.getByTitle('display viewer')).toBe(iframe)
  expect(iframe).toHaveAttribute('src', frameSrc)
  expect(iframe).not.toHaveAttribute('data-viewer-compact')
})

it('restores the resized expanded size after collapse while keeping the same stream frame', () => {
  vi.mocked(useDesktopViewport).mockReturnValue(true)
  const original = { width: window.innerWidth, height: window.innerHeight }
  const resizeWindow = (width: number, height: number) => {
    window.innerWidth = width
    window.innerHeight = height
    fireEvent.resize(window)
  }
  try {
    resizeWindow(1440, 1000)
    render(<Console />)
    const iframe = screen.getByTitle<HTMLIFrameElement>('display viewer')
    const frameWindow = iframe.contentWindow
    const frameSrc = iframe.getAttribute('src')
    fireEvent.click(screen.getByRole('button', { name: 'Minimize player' }))
    const player = screen.getByRole('region', { name: 'Android app mini-player' })
    const expand = () => fireEvent.click(within(player).getByRole('button', { name: 'Expand mini-player' }))
    const collapse = () => fireEvent.click(within(player).getByRole('button', { name: 'Collapse mini-player' }))
    expand()
    const initialWidth = Number.parseFloat(player.style.width)
    const rect = vi.spyOn(player, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, initialWidth, 0))
    try {
      fireEvent.keyDown(within(player).getByRole('button', { name: 'Resize mini-player' }), { key: 'ArrowRight' })
    } finally {
      rect.mockRestore()
    }
    const assertExpandedSize = (width: number) => {
      const header = within(player).getByRole('group', { name: 'Mini-player controls' })
      const videoHeight = Number.parseFloat(player.style.height) - Number.parseFloat(header.style.height) - 6
      expect(Number.parseFloat(player.style.width)).toBeCloseTo(width)
      expect(width / videoHeight).toBeCloseTo(displaySize.width / displaySize.height)
      expect(screen.getByTitle('display viewer')).toBe(iframe)
      expect(iframe.contentWindow).toBe(frameWindow)
      expect(iframe).toHaveAttribute('src', frameSrc)
    }
    const customWidth = initialWidth + 24
    assertExpandedSize(customWidth)

    collapse()
    expect(Number.parseFloat(player.style.width)).toBeLessThan(customWidth)
    expect(iframe).toHaveAttribute('data-viewer-compact')
    expand()
    assertExpandedSize(customWidth)

    collapse()
    resizeWindow(1100, 400)
    expand()
    const constrainedWidth = Number.parseFloat(player.style.width)
    expect(constrainedWidth).toBeLessThan(customWidth)
    assertExpandedSize(constrainedWidth)
    resizeWindow(1440, 1000)
    assertExpandedSize(customWidth)
  } finally {
    resizeWindow(original.width, original.height)
  }
})

it('minimizes with i outside text fields only when keyboard capture is off', () => {
  vi.mocked(useDesktopViewport).mockReturnValue(true)
  const view = render(<Console captures />)
  const iframe = screen.getByTitle('display viewer')
  fireEvent.keyDown(window, { key: 'i' })
  expect(iframe).not.toHaveAttribute('data-viewer-compact')

  view.rerender(<Console />)
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'i' })
  expect(iframe).not.toHaveAttribute('data-viewer-compact')
  fireEvent.keyDown(window, { key: 'i' })
  expect(iframe).toHaveAttribute('data-viewer-compact')
})

it.each(['webrtc', 'websocket'] as const)(
  'keeps the %s frame connected across rotation and a narrow window on another page',
  transport => {
    vi.mocked(useDesktopViewport).mockReturnValue(true)
    const original = { width: window.innerWidth, height: window.innerHeight }
    const view = render(<Console />)
    const iframe = screen.getByTitle<HTMLIFrameElement>('display viewer')
    const frameWindow = iframe.contentWindow!
    const frameSrc = iframe.getAttribute('src')
    fireEvent.click(screen.getByRole('button', { name: 'Minimize player' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand mini-player' }))
    view.rerender(<Console route='overview' />)
    const card = screen.getByRole('region', { name: 'Android app mini-player' })
    const assertGeometry = (ratio: number) => {
      const x = Number.parseFloat(card.style.left)
      const y = Number.parseFloat(card.style.top)
      const width = Number.parseFloat(card.style.width)
      const height = Number.parseFloat(card.style.height)
      const header = within(card).getByRole('group', { name: 'Mini-player controls' })
      const headerHeight = Number.parseFloat(header.style.height)
      expect(card).toHaveStyle({ rowGap: '6px' })
      expect(width / (height - headerHeight - 6)).toBeCloseTo(ratio)
      // This fixture is docked bottom-right; its 36px toolbar plus 8px gap faces left.
      expect(x - 44).toBeGreaterThanOrEqual(24 - 1e-8)
      expect(x + width).toBeLessThanOrEqual(window.innerWidth - 24 + 1e-8)
      expect(y).toBeGreaterThanOrEqual(24 - 1e-8)
      expect(y + height).toBeLessThanOrEqual(window.innerHeight - 24 + 1e-8)
      expect(screen.getByTitle('display viewer')).toBe(iframe)
      expect(iframe.contentWindow).toBe(frameWindow)
      expect(iframe).toHaveAttribute('src', frameSrc)
      expect(screen.getByRole('group', { name: 'Viewer toolbar' })).toBeVisible()
    }
    const rotate = (width: number, height: number) =>
      fireEvent(
        window,
        new MessageEvent('message', {
          source: frameWindow,
          origin: window.location.origin,
          data: {
            type: 'rebroid-viewer-stream-metrics-v4',
            version: 4,
            transport,
            renderer: transport === 'webrtc' ? 'webrtc-video' : 'chromium-webcodecs',
            width,
            height,
            effectiveProfile: {
              transport,
              codec: 'h264',
              maxSize: 2340,
              maxFps: 60,
              bitrate: 8000000,
              iFrameInterval: 1,
              audio: true
            },
            collectedAt: Date.now()
          }
        })
      )
    try {
      assertGeometry(1080 / 2340)
      rotate(2340, 1080)
      assertGeometry(2340 / 1080)
      window.innerWidth = 320
      window.innerHeight = 240
      vi.mocked(useDesktopViewport).mockReturnValue(false)
      fireEvent.resize(window)
      view.rerender(<Console route='overview' />)
      assertGeometry(2340 / 1080)
      rotate(1080, 2340)
      assertGeometry(1080 / 2340)
      window.innerWidth = 1600
      window.innerHeight = 900
      vi.mocked(useDesktopViewport).mockReturnValue(true)
      fireEvent.resize(window)
      view.rerender(<Console route='overview' />)
      assertGeometry(1080 / 2340)
    } finally {
      window.innerWidth = original.width
      window.innerHeight = original.height
      vi.mocked(useDesktopViewport).mockReturnValue(true)
    }
  }
)
