'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { fitMiniPlayer, type MiniPlayerSize } from './mini-player-geometry'

export const useMiniPlayerResize = (
  player: RefObject<HTMLDivElement | null>,
  ratio: number,
  toolbarSpace: number,
  viewport: MiniPlayerSize & { rem: number }
) => {
  // This preference belongs to the player, whose lifetime spans compact and expanded mode.
  const [preferredExpandedWidth, setPreferredExpandedWidth] = useState<number>()
  const gesture = useRef<{
    id: number
    x: number
    y: number
    width: number
    directionX: number
    directionY: number
  } | null>(null)
  const limit = (next: number) =>
    fitMiniPlayer({
      viewport,
      ratio,
      expanded: true,
      preferredWidth: Math.max(96, next),
      toolbarSpace,
      rem: viewport.rem
    }).width
  const start = (event: PointerEvent<HTMLButtonElement>, right: boolean, bottom: boolean) => {
    if (event.button !== 0 || !event.isPrimary || gesture.current) return
    const rect = player.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      directionX: right ? 1 : -1,
      directionY: bottom ? 1 : -1
    }
  }
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.id !== event.pointerId) return
    gesture.current = null
  }
  return {
    preferredExpandedWidth,
    start,
    handle: {
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        const active = gesture.current
        if (!active || active.id !== event.pointerId) return
        const dx = (event.clientX - active.x) * active.directionX
        const dy = (event.clientY - active.y) * active.directionY * ratio
        setPreferredExpandedWidth(limit(active.width + (Math.abs(dx) > Math.abs(dy) ? dx : dy)))
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return
        event.preventDefault()
        const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1
        setPreferredExpandedWidth(limit((player.current?.getBoundingClientRect().width ?? 240) + direction * 24))
      }
    }
  }
}
