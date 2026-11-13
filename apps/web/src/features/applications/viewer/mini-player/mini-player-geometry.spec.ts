import { expect, it } from 'vitest'
import { fitMiniPlayer, getMiniPlayerLayout, miniPlayerToolbarSpace, type MiniPlayerEdge } from './mini-player-geometry'

it.each<MiniPlayerEdge>(['left', 'right', 'top', 'bottom'])(
  'keeps the display and toolbar inside every viewport when docked %s',
  edge => {
    // Covers centered top/bottom docks where reserving only the video width overflowed the toolbar.
    for (const offset of [0, 0.49, 0.5, 0.51, 1]) {
      for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 1040, height: 360 },
        { width: 320, height: 240 }
      ]) {
        for (const ratio of [1080 / 2340, 2340 / 1080, 16 / 9]) {
          for (const preferredWidth of [undefined, 240, 1600]) {
            const size = fitMiniPlayer({
              viewport,
              ratio,
              expanded: true,
              preferredWidth,
              toolbarSpace: miniPlayerToolbarSpace
            })
            const layout = getMiniPlayerLayout({ edge, offset }, size, viewport, miniPlayerToolbarSpace)
            const left = layout.x - (layout.toolbarSide === 'left' ? miniPlayerToolbarSpace : 0)
            const right = layout.x + size.width + (layout.toolbarSide === 'right' ? miniPlayerToolbarSpace : 0)
            expect(left).toBeGreaterThanOrEqual(24 - 1e-8)
            expect(right).toBeLessThanOrEqual(viewport.width - 24 + 1e-8)
            expect(layout.y).toBeGreaterThanOrEqual(24 - 1e-8)
            expect(layout.y + size.height).toBeLessThanOrEqual(viewport.height - 24 + 1e-8)
            expect(size.width / size.videoHeight).toBeCloseTo(ratio)
            expect(size.height - size.videoHeight).toBeCloseTo(28)
          }
        }
      }
    }
  }
)

it('reclamps an active drag after a viewport shrink or Android rotation', () => {
  const viewport = { width: 320, height: 240 }
  for (const ratio of [1080 / 2340, 2340 / 1080]) {
    const size = fitMiniPlayer({
      viewport,
      ratio,
      expanded: true,
      preferredWidth: 1000,
      toolbarSpace: miniPlayerToolbarSpace
    })
    for (const point of [
      { x: 1400, y: 700 },
      { x: -200, y: -300 }
    ]) {
      const layout = getMiniPlayerLayout({ edge: 'bottom', offset: 1 }, size, viewport, miniPlayerToolbarSpace, point)
      expect(layout.x).toBeGreaterThanOrEqual(layout.bounds.minX)
      expect(layout.x).toBeLessThanOrEqual(layout.bounds.maxX)
      expect(layout.y).toBeGreaterThanOrEqual(24)
      expect(layout.y + size.height).toBeLessThanOrEqual(viewport.height - 24)
    }
  }
})
