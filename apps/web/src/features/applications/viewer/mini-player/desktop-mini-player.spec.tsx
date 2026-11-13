import type { CSSProperties } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DesktopMiniPlayer } from './desktop-mini-player'

it('offers compact and expanded actions without replacing the player frame', () => {
  const onClose = vi.fn()
  const onExpandedChange = vi.fn()
  const player = (expanded: boolean, canExpand: boolean, inlineStyle?: CSSProperties) => (
    <TooltipProvider>
      <DesktopMiniPlayer
        name='Maps'
        viewerHref='/viewer/apps/maps'
        expanded={expanded}
        canExpand={canExpand}
        inlineStyle={inlineStyle}
        aspectRatio={0.5}
        expandedActions={<button type='button'>Toolbar</button>}
        onExpandedChange={onExpandedChange}
        onClose={onClose}
      >
        <div data-testid='player-frame' />
      </DesktopMiniPlayer>
    </TooltipProvider>
  )

  const { rerender } = render(player(false, false))
  expect(screen.queryByRole('button', { name: 'Expand mini-player' })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Muted' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open viewer' })).toHaveAttribute('href', '/viewer/apps/maps')
  const frame = screen.getByTestId('player-frame')
  expect(screen.queryByRole('button', { name: 'Toolbar' })).not.toBeInTheDocument()
  const card = screen.getByRole('region', { name: 'Maps mini-player' })
  // eslint-disable-next-line testing-library/no-node-access
  const media = frame.closest<HTMLElement>('[style*="aspect-ratio"]')
  expect(media?.style.aspectRatio).toBe('0.5 / 1')

  rerender(player(false, true))
  fireEvent.click(screen.getByRole('button', { name: 'Expand mini-player' }))
  expect(onExpandedChange).toHaveBeenLastCalledWith(true)
  rerender(player(true, true))
  expect(screen.queryByRole('img', { name: 'Muted' })).not.toBeInTheDocument()
  expect(screen.getByTestId('player-frame')).toBe(frame)
  expect(media?.style.aspectRatio).toBe('0.5 / 1')
  expect(screen.getByRole('button', { name: 'Toolbar' })).toBeVisible()
  const header = screen.getByRole('group', { name: 'Mini-player controls' })
  expect(header).not.toHaveClass('absolute')
  expect(header).not.toHaveClass('opacity-0')
  expect(Number.parseFloat(card.style.height)).toBeCloseTo(
    Number.parseFloat(header.style.height) + Number.parseFloat(media!.style.height)
  )
  fireEvent.click(within(header).getByRole('button', { name: 'Collapse mini-player' }))
  expect(onExpandedChange).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole('button', { name: 'Close mini-player' }))
  expect(onClose).toHaveBeenCalledOnce()

  rerender(player(false, true, { left: 20, top: 30, width: 240, height: 480 }))
  expect(screen.getByTestId('player-frame')).toBe(frame)
  expect(card).toHaveStyle({ left: '20px', top: '30px', width: '240px', height: '480px' })
  expect(screen.queryByRole('link', { name: 'Open viewer' })).not.toBeInTheDocument()
})

it('snaps a drag from the collapsed display to the nearest edge and keeps the edge on resize', () => {
  const onExpandedChange = vi.fn()
  render(
    <TooltipProvider>
      <DesktopMiniPlayer
        name='Maps'
        viewerHref='/viewer/apps/maps'
        expanded={false}
        canExpand
        onExpandedChange={onExpandedChange}
        onClose={vi.fn()}
      >
        <div />
      </DesktopMiniPlayer>
    </TooltipProvider>
  )
  const card = screen.getByRole('region', { name: 'Maps mini-player' })
  const dragSurface = screen.getByRole('button', { name: 'Expand mini-player' })
  const cancelAnimation = vi.fn()
  const animate = vi.fn(() => ({ cancel: cancelAnimation }))
  const matchMedia = vi.fn(() => ({ matches: false }))
  vi.stubGlobal('matchMedia', matchMedia)
  Object.defineProperty(card, 'animate', { value: animate })
  const capture = vi.fn()
  Object.defineProperty(dragSurface, 'setPointerCapture', { value: capture })
  const pointer = (type: string, clientX: number, clientY: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    fireEvent(dragSurface, event)
  }
  const width = window.innerWidth
  const height = window.innerHeight
  window.innerWidth = 1200
  window.innerHeight = 800
  fireEvent.resize(window)
  const rect = vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(992, 492, 200, 300))
  try {
    pointer('pointerdown', 1002, 502)
    expect(capture).toHaveBeenCalledWith(1)
    pointer('pointermove', 38, 260)
    expect(card).toHaveStyle({ left: '28px', top: '250px' })
    pointer('pointerup', 38, 260)
    expect(animate).toHaveBeenCalledWith(expect.any(Array), { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    matchMedia.mockReturnValue({ matches: true })
    fireEvent.click(dragSurface)
    expect(onExpandedChange).not.toHaveBeenCalled()
    expect(card).toHaveStyle({ left: '24px' })
    expect(Number.parseFloat(card.style.top) + Number.parseFloat(card.style.height)).toBeLessThanOrEqual(
      window.innerHeight - 24
    )
    window.innerWidth = 500
    window.innerHeight = 370
    fireEvent.resize(window)
    expect(cancelAnimation).toHaveBeenCalled()
    expect(card).toHaveStyle({ left: '24px' })
    expect(Number.parseFloat(card.style.top) + Number.parseFloat(card.style.height)).toBeLessThanOrEqual(
      window.innerHeight - 24
    )

    rect.mockReturnValue(new DOMRect(24, 35, 200, 300))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move mini-player' }), { key: 'ArrowUp', shiftKey: true })
    expect(card).toHaveStyle({ top: '24px', left: '24px' })
    pointer('pointerdown', 30, 40)
    pointer('pointerup', 30, 40)
    fireEvent.click(dragSurface)
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(true)
    expect(animate).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
    rect.mockRestore()
    window.innerWidth = width
    window.innerHeight = height
  }
})

it('resizes the expanded display with a fixed aspect ratio and places tools inward from the dock', () => {
  render(
    <TooltipProvider>
      <DesktopMiniPlayer
        name='Maps'
        viewerHref='/viewer/apps/maps'
        expanded
        canExpand
        aspectRatio={0.5}
        expandedToolbar={
          <div
            role='group'
            aria-label='Device controls'
          />
        }
        onExpandedChange={vi.fn()}
        onClose={vi.fn()}
      >
        <iframe title='Android display' />
      </DesktopMiniPlayer>
    </TooltipProvider>
  )
  const card = screen.getByRole('region', { name: 'Maps mini-player' })
  const frame = screen.getByTitle('Android display')
  const resize = screen.getByRole('button', { name: 'Resize mini-player' })
  expect(resize).toBeEmptyDOMElement()
  expect(resize).toHaveClass('right-full', 'cursor-nwse-resize')
  const controls = screen.getByRole('group', { name: 'Device controls' })
  // eslint-disable-next-line testing-library/no-node-access
  expect(controls.parentElement).toHaveAttribute('data-toolbar-side', 'left')
  const width = window.innerWidth
  const height = window.innerHeight
  window.innerWidth = 1200
  window.innerHeight = 800
  fireEvent.resize(window)
  const rect = vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(976, 376, 200, 400))
  Object.defineProperty(resize, 'setPointerCapture', { value: vi.fn() })
  const pointer = (type: string, clientX: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY: 400 })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    fireEvent(resize, event)
  }
  try {
    pointer('pointerdown', 976)
    pointer('pointermove', 876)
    expect(card.style.width).toContain('300px')
    pointer('pointermove', 0)
    expect(card.style.width).toContain('362px')
    pointer('pointerup', 0)
    expect(screen.getByTitle('Android display')).toBe(frame)
    rect.mockReturnValue(new DOMRect(24, 376, 200, 400))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move mini-player' }), { key: 'ArrowLeft' })
    // eslint-disable-next-line testing-library/no-node-access
    expect(controls.parentElement).toHaveAttribute('data-toolbar-side', 'right')
    expect(resize).toHaveClass('left-full', 'cursor-nesw-resize')
    fireEvent.keyDown(resize, { key: 'ArrowRight' })
    expect(card.style.width).toContain('224px')
  } finally {
    vi.unstubAllGlobals()
    rect.mockRestore()
    window.innerWidth = width
    window.innerHeight = height
  }
})
