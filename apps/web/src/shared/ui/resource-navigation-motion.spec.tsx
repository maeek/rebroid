import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceNavigation } from './resource-navigation'
import { ResourceNavigationMotionScope } from './resource-navigation-motion-scope'

const animations: { cancel: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; playState: string }[] = []
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')

beforeEach(() => {
  animations.length = 0
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  )
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: vi.fn(() => {
      const animation = { playState: 'running', cancel: vi.fn(), play: vi.fn() }
      animation.cancel.mockImplementation(() => {
        animation.playState = 'idle'
      })
      animation.play.mockImplementation(() => {
        animation.playState = 'running'
      })
      animations.push(animation)
      return animation
    })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate)
  else Reflect.deleteProperty(HTMLElement.prototype, 'animate')
})

const Navigation = ({ current }: { current: string }) => (
  <StrictMode>
    <ResourceNavigationMotionScope>
      <ResourceNavigation
        key={current}
        label='App sections'
        items={['overview', 'activity', 'diagnostics', 'configuration'].map(id => ({
          id,
          label: id,
          icon: null,
          current: id === current
        }))}
      />
    </ResourceNavigationMotionScope>
  </StrictMode>
)

describe('resource navigation motion across development remounts', () => {
  it('keeps the selected-tab animation running after Strict Mode replays effects', () => {
    const { rerender, unmount } = render(<Navigation current='overview' />)
    expect(animations).toHaveLength(0)

    for (const current of ['configuration', 'overview', 'activity', 'diagnostics', 'configuration']) {
      rerender(<Navigation current={current} />)
      expect(animations.at(-1)?.playState).toBe('running')
    }

    unmount()
    expect(animations.at(-1)?.playState).toBe('idle')
  })

  it('does not start or resume a glide when reduced motion is enabled', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    )
    const { rerender } = render(<Navigation current='overview' />)
    rerender(<Navigation current='configuration' />)
    rerender(<Navigation current='overview' />)
    expect(animations).toHaveLength(0)
  })
})
