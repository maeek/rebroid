import { describe, expect, it } from 'vitest'
import { fitAspectRatio, getDisplayViewportSize, getFullscreenMediaSize, surfaceAspectRatio } from './surface-layout'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

const surface: DisplayViewerSurface = {
  id: 'main',
  kind: 'main',
  name: 'Main display',
  src: 'https://example.test/viewer',
  popoutUrl: 'https://example.test/popout',
  sessionId: 'session-1',
  surfaceId: 'surface-1',
  displaySize: { width: 1080, height: 1920 }
}

describe('display viewer surface layout', () => {
  it('calculates rotated and unrotated aspect ratios', () => {
    expect(surfaceAspectRatio(surface, false)).toBeCloseTo(1080 / 1920)
    expect(surfaceAspectRatio(surface, true)).toBeCloseTo(1920 / 1080)
  })

  it('fits media inside the limiting dimension', () => {
    expect(fitAspectRatio(16 / 9, 1000, 400)).toEqual({ width: 711, height: 400 })
    expect(fitAspectRatio(16 / 9, 500, 1000)).toEqual({ width: 500, height: 281 })
  })

  it('uses workspace height when available and fallback height otherwise', () => {
    expect(getDisplayViewportSize({ surface, rotated: false, workspaceHeight: 800 })).toEqual({
      width: 414,
      height: 736
    })
    expect(getDisplayViewportSize({ surface, rotated: true, workspaceHeight: 0 })).toEqual({
      width: 1138,
      height: 640
    })
  })

  it('fits fullscreen media against current window size', () => {
    expect(getFullscreenMediaSize({ surface, rotated: false, windowSize: { width: 500, height: 500 } })).toEqual({
      width: 281,
      height: 500
    })
  })
})
