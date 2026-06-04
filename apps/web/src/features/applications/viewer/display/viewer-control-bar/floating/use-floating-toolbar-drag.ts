'use client'

import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import type { DragState, FloatingPosition } from '@/features/applications/viewer/display/viewer-control-bar/types'

export const clampFloatingPosition = (nextX: number, nextY: number): FloatingPosition => {
  const maxX = typeof window === 'undefined' ? nextX : window.innerWidth - 72
  const maxY = typeof window === 'undefined' ? nextY : window.innerHeight - 72

  return {
    x: Math.min(Math.max(8, nextX), Math.max(8, maxX)),
    y: Math.min(Math.max(8, nextY), Math.max(8, maxY))
  }
}

const getDraggedPosition = (state: DragState, clientX: number, clientY: number) =>
  clampFloatingPosition(state.originX + clientX - state.startX, state.originY + clientY - state.startY)

const getMatchingDragState = (dragState: { current: DragState | null }, pointerId: number) => {
  const state = dragState.current
  return state?.pointerId === pointerId ? state : null
}

const releasePointerCapture = (event: PointerEvent<HTMLButtonElement>) => {
  try {
    event.currentTarget.releasePointerCapture(event.pointerId)
  } catch {
    // Pointer capture may already be gone on mobile browsers.
  }
}

const capturePointer = (event: PointerEvent<HTMLButtonElement>) => {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // Some mobile browsers do not retain capture when the dragged element moves.
  }
}

const createFloatingDragCleanup =
  (
    handleWindowPointerMove: (event: globalThis.PointerEvent) => void,
    finishWindowDrag: (event: globalThis.PointerEvent) => void,
    cleanupRef: { current: (() => void) | null }
  ) =>
  () => {
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', finishWindowDrag)
    window.removeEventListener('pointercancel', finishWindowDrag)
    cleanupRef.current = null
  }

const clearFloatingDragCleanup = (cleanupRef: { current: (() => void) | null }) => {
  cleanupRef.current?.()
}

const registerFloatingWindowDrag = ({
  cleanupRef,
  dragState,
  setFloatingPosition
}: {
  cleanupRef: { current: (() => void) | null }
  dragState: { current: DragState | null }
  setFloatingPosition: (position: FloatingPosition) => void
}) => {
  const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
    const state = getMatchingDragState(dragState, moveEvent.pointerId)
    if (!state) {
      return
    }

    moveEvent.preventDefault()
    setFloatingPosition(getDraggedPosition(state, moveEvent.clientX, moveEvent.clientY))
  }

  const finishWindowDrag = (upEvent: globalThis.PointerEvent) => {
    const state = getMatchingDragState(dragState, upEvent.pointerId)
    if (!state) {
      return
    }

    upEvent.preventDefault()
    dragState.current = null
    cleanupRef.current?.()
  }

  window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
  window.addEventListener('pointerup', finishWindowDrag, { passive: false })
  window.addEventListener('pointercancel', finishWindowDrag, { passive: false })
  cleanupRef.current = createFloatingDragCleanup(handleWindowPointerMove, finishWindowDrag, cleanupRef)
}

export const useFloatingToolbarDrag = (
  floatingPosition: FloatingPosition,
  setFloatingPosition: (position: FloatingPosition) => void
) => {
  const floatingDragCleanup = useRef<(() => void) | null>(null)
  const dragState = useRef<DragState | null>(null)

  useEffect(() => {
    return () => clearFloatingDragCleanup(floatingDragCleanup)
  }, [])

  const handleFloatingPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    floatingDragCleanup.current?.()
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: floatingPosition.x,
      originY: floatingPosition.y
    }

    capturePointer(event)
    registerFloatingWindowDrag({ cleanupRef: floatingDragCleanup, dragState, setFloatingPosition })
  }

  const handleFloatingPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = getMatchingDragState(dragState, event.pointerId)
    if (!state) {
      return
    }

    setFloatingPosition(getDraggedPosition(state, event.clientX, event.clientY))
  }

  const handleFloatingPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = getMatchingDragState(dragState, event.pointerId)
    if (!state) {
      return
    }

    dragState.current = null
    floatingDragCleanup.current?.()
    releasePointerCapture(event)
  }

  return {
    handleFloatingPointerDown,
    handleFloatingPointerMove,
    handleFloatingPointerUp
  }
}
