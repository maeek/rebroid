'use client'

import { useLayoutEffect, useRef, useState, type RefObject, type KeyboardEvent, type PointerEvent } from 'react'
import {
  clampMiniPlayer,
  getMiniPlayerLayout,
  isVerticalEdge,
  type MiniPlayerBounds,
  type MiniPlayerDock as Dock,
  type MiniPlayerEdge as Edge,
  type MiniPlayerPoint as Position,
  type MiniPlayerSize
} from './mini-player-geometry'

const keyboardStep = 24
const keyEdges: Readonly<Record<string, Edge>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom'
}

const nearestEdge = ({ x, y }: Position, { minX, minY, maxX, maxY }: MiniPlayerBounds): Edge => {
  const distances = [
    { edge: 'left', distance: x - minX },
    { edge: 'right', distance: maxX - x },
    { edge: 'top', distance: y - minY },
    { edge: 'bottom', distance: maxY - y }
  ] as const
  return distances.reduce((nearest, candidate) => (candidate.distance < nearest.distance ? candidate : nearest)).edge
}

const dockAt = (edge: Edge, { x, y }: Position, { minX, minY, maxX, maxY }: MiniPlayerBounds): Dock => {
  const offset = isVerticalEdge(edge) ? (y - minY) / (maxY - minY) : (x - minX) / (maxX - minX)
  return { edge, offset: Number.isFinite(offset) ? offset : 0 }
}

export const useMiniPlayerPosition = (
  playerRef: RefObject<HTMLDivElement | null>,
  size: MiniPlayerSize,
  viewport: MiniPlayerSize,
  toolbarSpace: number
) => {
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const dragStart = useRef<Position | null>(null)
  const moved = useRef(false)
  const snapFrom = useRef<DOMRect | null>(null)
  const animation = useRef<Animation | null>(null)
  const [dock, setDock] = useState<Dock>({ edge: 'bottom', offset: 1 })
  const [dragPosition, setDragPosition] = useState<Position | null>(null)

  const layout = getMiniPlayerLayout(dock, size, viewport, toolbarSpace, dragPosition)
  const { minX, minY, maxX, maxY } = layout.bounds
  useLayoutEffect(() => {
    const from = snapFrom.current
    const player = playerRef.current
    snapFrom.current = null
    if (!from || !player?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const to = player.getBoundingClientRect()
    // A snap can switch toolbar sides; bound its starting position with the new rail too.
    const start = clampMiniPlayer({ x: from.left, y: from.top }, { minX, minY, maxX, maxY })
    const transform = getComputedStyle(player).transform
    const destination = transform === 'none' ? '' : transform
    animation.current = player.animate(
      [
        { transform: `translate(${start.x - to.left}px, ${start.y - to.top}px) ${destination}` },
        { transform: destination || 'none' }
      ],
      { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )
    return () => animation.current?.cancel()
  }, [dock, playerRef, size.width, size.height, viewport.width, viewport.height, minX, minY, maxX, maxY])

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return
    const rect = playerRef.current?.getBoundingClientRect()
    if (!rect) return
    animation.current?.cancel()
    dragStart.current = { x: event.clientX, y: event.clientY }
    moved.current = false

    event.preventDefault()
    if (event.currentTarget.tabIndex >= 0) event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    }
    setDragPosition({ x: rect.left, y: rect.top })
  }

  const pointerPosition = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    const rect = playerRef.current?.getBoundingClientRect()
    if (!current || current.pointerId !== event.pointerId || !rect) return null
    const proposed = { x: event.clientX - current.offsetX, y: event.clientY - current.offsetY }
    const next = getMiniPlayerLayout(dock, size, viewport, toolbarSpace, proposed)
    return { position: { x: next.x, y: next.y }, bounds: next.bounds }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    const start = dragStart.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) moved.current = true
    const next = pointerPosition(event)
    if (next) setDragPosition(next.position)
  }

  const cancelDrag = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    dragStart.current = null
    setDragPosition(null)
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const next = pointerPosition(event)
    if (!next) return
    snapFrom.current = playerRef.current?.getBoundingClientRect() ?? null
    setDock(dockAt(nearestEdge(next.position, next.bounds), next.position, next.bounds))
    cancelDrag(event)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!Object.hasOwn(keyEdges, event.key) || event.altKey || event.ctrlKey || event.metaKey || drag.current) return
    const rect = playerRef.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    const direction = keyEdges[event.key]
    const step = event.shiftKey ? keyboardStep * 3 : keyboardStep
    const { bounds } = getMiniPlayerLayout(dock, size, viewport, toolbarSpace)
    if (isVerticalEdge(direction) === isVerticalEdge(dock.edge)) {
      setDock(dockAt(direction, clampMiniPlayer({ x: rect.left, y: rect.top }, bounds), bounds))
      return
    }
    const delta = direction === 'left' || direction === 'top' ? -step : step
    const position = {
      x: rect.left + (isVerticalEdge(dock.edge) ? 0 : delta),
      y: rect.top + (isVerticalEdge(dock.edge) ? delta : 0)
    }
    const clamped = clampMiniPlayer(position, bounds)
    const nextEdge = position.x !== clamped.x || position.y !== clamped.y ? direction : dock.edge
    setDock(dockAt(nextEdge, clamped, bounds))
  }

  const dragSurface = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag
  }

  return {
    toolbarSide: layout.toolbarSide,
    positionStyle: { left: layout.x, top: layout.y },
    dragging: dragPosition !== null,
    wasDragged: () => moved.current,
    dragSurface,
    dragHandle: { ...dragSurface, onKeyDown }
  }
}
