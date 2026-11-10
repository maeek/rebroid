import { describe, expect, it } from 'vitest'
import { fitAspectRatio, getDisplayViewportSize } from './surface-layout'

describe('display viewer surface layout', () => {
  it('fits fullscreen media inside the limiting dimension', () => {
    expect(fitAspectRatio(16 / 9, 1000, 400)).toEqual({ width: 711, height: 400 })
    expect(fitAspectRatio(16 / 9, 500, 1000)).toEqual({ width: 500, height: 281 })
  })

  it('fits a landscape stream in a narrow split pane with space for the controls', () => {
    expect(
      getDisplayViewportSize({
        ratio: 16 / 9,
        workspaceSize: { width: 440, height: 800 },
        controlsEnabled: true
      })
    ).toEqual({ width: 384, height: 216 })
  })

  it('uses the available height when the stream returns to portrait', () => {
    expect(
      getDisplayViewportSize({
        ratio: 9 / 16,
        workspaceSize: { width: 500, height: 800 },
        controlsEnabled: true
      })
    ).toEqual({ width: 423, height: 752 })
  })

  it('fits short landscape browser windows', () => {
    expect(
      getDisplayViewportSize({
        ratio: 16 / 9,
        workspaceSize: { width: 800, height: 224 },
        controlsEnabled: false
      })
    ).toEqual({ width: 313, height: 176 })
  })

  it('reserves space for the wider touch control rail', () => {
    expect(
      getDisplayViewportSize({
        ratio: 16 / 9,
        workspaceSize: { width: 384, height: 600, railWidth: 44 },
        controlsEnabled: true
      })
    ).toEqual({ width: 316, height: 178 })
  })
})
