'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDisplayViewerActions } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-display-viewer-actions'
import { useFullscreenState } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-fullscreen-state'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const useDisplayViewerShellState = ({
  applicationId,
  surfaces,
  initialKeyboardCaptureEnabled,
  onSurfacesChanged,
  onKeyboardCaptureChange
}: {
  applicationId: string
  surfaces: DisplayViewerSurface[]
  initialKeyboardCaptureEnabled: boolean
  onSurfacesChanged?: () => void
  onKeyboardCaptureChange?: (enabled: boolean) => void
}) => {
  const [keyboardCaptureEnabled, setKeyboardCaptureEnabled] = useState(initialKeyboardCaptureEnabled)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const surfaceElementsRef = useRef<Record<string, HTMLElement | null>>({})
  const surfaceViewportElementsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollSettleTimerRef = useRef<number | null>(null)
  const [rotatedSurfaceIds, setRotatedSurfaceIds] = useState<Record<string, boolean>>({})
  const [workspaceHeight, setWorkspaceHeight] = useState(0)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [fullscreenSurfaceId, setFullscreenSurfaceId] = useState<string | null>(null)
  const { fullscreen, fullscreenElement, toggleFullscreen } = useFullscreenState()
  const orderedSurfaces = useMemo(
    () => [...surfaces].sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'main' ? -1 : 1)),
    [surfaces]
  )
  const [activeSurfaceId, setActiveSurfaceId] = useState(() => orderedSurfaces[0]?.id ?? 'main')
  const activeSurface = orderedSurfaces.find(surface => surface.id === activeSurfaceId) ?? orderedSurfaces[0]
  const viewerActions = useDisplayViewerActions({
    applicationId,
    orderedSurfaces,
    onSurfacesChanged,
    setActiveSurfaceId
  })

  useEffect(() => {
    setKeyboardCaptureEnabled(initialKeyboardCaptureEnabled)
  }, [initialKeyboardCaptureEnabled])

  useEffect(() => {
    if (orderedSurfaces.length === 0) {
      return
    }
    if (!orderedSurfaces.some(surface => surface.id === activeSurfaceId)) {
      setActiveSurfaceId(orderedSurfaces[0].id)
    }
  }, [activeSurfaceId, orderedSurfaces])

  useEffect(() => {
    setRotatedSurfaceIds(current =>
      Object.fromEntries(
        Object.entries(current).filter(([surfaceId]) => orderedSurfaces.some(surface => surface.id === surfaceId))
      )
    )
  }, [orderedSurfaces])

  useEffect(
    () => () => {
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current)
      }
    },
    []
  )

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return
    }

    const updateHeight = () => {
      setWorkspaceHeight(container.clientHeight)
    }
    const observer = new ResizeObserver(updateHeight)
    observer.observe(container)
    updateHeight()

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateWindowSize()
    window.addEventListener('resize', updateWindowSize)
    window.visualViewport?.addEventListener('resize', updateWindowSize)

    return () => {
      window.removeEventListener('resize', updateWindowSize)
      window.visualViewport?.removeEventListener('resize', updateWindowSize)
    }
  }, [])

  useEffect(() => {
    const surfaceEntry = Object.entries(surfaceViewportElementsRef.current).find(
      ([, element]) => fullscreenElement !== null && element === fullscreenElement
    )

    setFullscreenSurfaceId(surfaceEntry?.[0] ?? null)
  }, [fullscreenElement])

  const syncActiveSurfaceFromScroll = () => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const viewportCenter = container.scrollLeft + container.clientWidth / 2
    const nearestSurface = orderedSurfaces
      .map(surface => {
        const element = surfaceElementsRef.current[surface.id]
        if (!element) {
          return null
        }

        return {
          distance: Math.abs(element.offsetLeft + element.offsetWidth / 2 - viewportCenter),
          surface
        }
      })
      .filter((item): item is { distance: number; surface: DisplayViewerSurface } => Boolean(item))
      .sort((left, right) => left.distance - right.distance)[0]?.surface

    if (nearestSurface) {
      setActiveSurfaceId(nearestSurface.id)
    }
  }

  const handleWorkspaceScroll = () => {
    if (scrollSettleTimerRef.current !== null) {
      window.clearTimeout(scrollSettleTimerRef.current)
    }

    scrollSettleTimerRef.current = window.setTimeout(syncActiveSurfaceFromScroll, 120)
  }

  const toggleKeyboardCapture = () => {
    setKeyboardCaptureEnabled(current => {
      const nextEnabled = !current
      onKeyboardCaptureChange?.(nextEnabled)
      return nextEnabled
    })
  }

  const rotateSurface = (surface: DisplayViewerSurface) => {
    setRotatedSurfaceIds(current => ({
      ...current,
      [surface.id]: !current[surface.id]
    }))
  }

  const rotateActiveSurface = () => {
    if (activeSurface) {
      rotateSurface(activeSurface)
    }
  }

  const scrollSurfaceIntoView = (surfaceId: string) => {
    surfaceElementsRef.current[surfaceId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    })
  }

  return {
    activeSurface,
    fullscreen,
    fullscreenSurfaceId,
    keyboardCaptureEnabled,
    orderedSurfaces,
    rotatedSurfaceIds,
    scrollContainerRef,
    surfaceViewportElementsRef,
    viewerActions,
    windowSize,
    workspaceHeight,
    handleWorkspaceScroll,
    rotateActiveSurface,
    rotateSurface,
    scrollSurfaceIntoView,
    setActiveSurfaceId,
    surfaceElementsRef,
    toggleFullscreen,
    toggleKeyboardCapture
  }
}
