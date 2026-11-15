'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Position = { x: number; y: number }

const keyboardMoves: Record<string, Position> = {
  ArrowLeft: { x: -16, y: 0 },
  ArrowRight: { x: 16, y: 0 },
  ArrowUp: { x: 0, y: -16 },
  ArrowDown: { x: 0, y: 16 }
}

export const useFloatingToolbarDrag = () => {
  const boundsRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; offset: Position } | null>(null)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })

  const moveToolbar = (getPosition: (current: Position) => Position) => {
    const bounds = boundsRef.current
    const toolbar = toolbarRef.current
    if (!bounds || !toolbar) return

    const maxX = Math.max(0, bounds.clientWidth - toolbar.offsetWidth)
    const maxY = Math.max(0, bounds.clientHeight - toolbar.offsetHeight)
    setPosition(current => {
      const next = getPosition(current)
      const x = Math.min(maxX, Math.max(0, next.x))
      const y = Math.min(maxY, Math.max(0, next.y))
      return x === current.x && y === current.y ? current : { x, y }
    })
  }

  useLayoutEffect(() => {
    const bounds = boundsRef.current
    const toolbar = toolbarRef.current
    if (!bounds || !toolbar) return

    const resize = new ResizeObserver(() => moveToolbar(current => current))
    resize.observe(bounds)
    resize.observe(toolbar)
    return () => resize.disconnect()
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || drag.current || !toolbarRef.current) return
    const rect = toolbarRef.current.getBoundingClientRect()
    drag.current = {
      pointerId: event.pointerId,
      offset: { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.stopPropagation()
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const activeDrag = drag.current
    if (activeDrag?.pointerId !== event.pointerId || !boundsRef.current) return
    const bounds = boundsRef.current.getBoundingClientRect()
    const x = event.clientX - bounds.left - activeDrag.offset.x
    const y = event.clientY - bounds.top - activeDrag.offset.y
    moveToolbar(() => ({ x, y }))
  }

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = keyboardMoves[event.key]
    if (!move) return
    event.preventDefault()
    event.stopPropagation()
    moveToolbar(current => ({ x: current.x + move.x, y: current.y + move.y }))
  }

  return {
    boundsRef,
    toolbarRef,
    position,
    dragHandle: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onLostPointerCapture: finishDrag,
      onKeyDown
    }
  }
}
