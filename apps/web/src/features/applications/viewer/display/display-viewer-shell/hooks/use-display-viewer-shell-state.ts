'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DisplaySessionRecovery } from '@/features/applications/viewer/display/display-session-recovery'
import { useDisplayViewerActions } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-display-viewer-actions'
import { useDisplayViewerRetry } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-display-viewer-retry'
import { useFullscreenState } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-fullscreen-state'
import {
  controlRailGap,
  getDisplayViewportSize,
  surfaceChromeHeight,
  viewerControlRailWidth,
  workspacePadding
} from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-layout'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'
import type {
  ViewerStreamMetricsV4,
  ViewerFrameObservation,
  ViewerStreamStatus
} from '@rebroid/android-application-core/viewer-stream'

const transientStreamStatusCodes = new Set<ViewerStreamStatus['code']>([
  'first-frame-timeout',
  'video-stalled',
  'stream-error'
])
const transientStreamStatusTtlMs = 6_000

const getSurfaceScrollLeft = (workspace: HTMLDivElement, surface: HTMLElement) =>
  Math.max(
    0,
    Math.min(
      workspace.scrollWidth - workspace.clientWidth,
      surface.offsetLeft + (surface.offsetWidth - workspace.clientWidth) / 2
    )
  )

export const useDisplayViewerShellState = ({
  applicationId,
  surfaces,
  controlsEnabled = false,
  compact = false,
  surfaceRefreshVersion,
  initialKeyboardCaptureEnabled,
  onSurfacesChanged,
  onKeyboardCaptureChange,
  onStreamMetrics,
  onStreamIssue,
  onFirstFrame
}: {
  applicationId: string
  surfaces: DisplayViewerSurface[]
  controlsEnabled?: boolean
  compact?: boolean
  surfaceRefreshVersion?: number
  initialKeyboardCaptureEnabled: boolean
  onSurfacesChanged?: () => void
  onKeyboardCaptureChange?: (enabled: boolean) => void
  onStreamMetrics?: (surfaceId: string, metrics: ViewerStreamMetricsV4) => void
  onStreamIssue?: (surfaceId: string, status: ViewerStreamStatus) => void
  onFirstFrame?: (observation?: ViewerFrameObservation) => void
}) => {
  const [keyboardCaptureEnabled, setKeyboardCaptureEnabled] = useState(initialKeyboardCaptureEnabled)
  const [sessionRecovery] = useState(() => new DisplaySessionRecovery())
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const surfaceElementsRef = useRef<Record<string, HTMLElement | null>>({})
  const surfaceViewportElementsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const surfaceSessionIdsRef = useRef<Record<string, string>>({})
  const scrollSettleTimerRef = useRef<number | null>(null)
  const streamStatusTimersRef = useRef<Record<string, number | undefined>>({})
  const [streamSizes, setStreamSizes] = useState<Record<string, { width: number; height: number }>>({})
  const [streamStatuses, setStreamStatuses] = useState<Record<string, ViewerStreamStatus | undefined>>({})
  const [workspaceSize, setWorkspaceSize] = useState({
    width: 0,
    height: 0,
    railWidth: viewerControlRailWidth,
    chromeHeight: surfaceChromeHeight,
    headerSpace: 40,
    gap: 0
  })
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [fullscreenSurfaceId, setFullscreenSurfaceId] = useState<string | null>(null)
  const { fullscreen, fullscreenElement, toggleFullscreen } = useFullscreenState()
  const orderedSurfaces = useMemo(
    () => [...surfaces].sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'main' ? -1 : 1)),
    [surfaces]
  )
  const multipleDisplays = orderedSurfaces.length > 1
  const viewportSizes = useMemo(
    () =>
      Object.fromEntries(
        orderedSurfaces.map(surface => {
          const { width, height } = streamSizes[surface.id] ?? surface.displaySize
          return [
            surface.id,
            getDisplayViewportSize({
              ratio: width / height,
              workspaceSize: { ...workspaceSize, headerSpace: multipleDisplays ? workspaceSize.headerSpace : 0 },
              compact,
              controlsEnabled
            })
          ]
        })
      ),
    [compact, controlsEnabled, multipleDisplays, orderedSurfaces, streamSizes, workspaceSize]
  )
  const workspaceContentWidth = workspaceSize.width - workspacePadding
  const railSpace = controlsEnabled ? workspaceSize.railWidth + controlRailGap : 0
  const displaysWidth = orderedSurfaces.reduce(
    (width, surface) => width + viewportSizes[surface.id].width + railSpace,
    0
  )
  const compactSwitcher =
    !compact &&
    multipleDisplays &&
    workspaceContentWidth > 0 &&
    displaysWidth + (orderedSurfaces.length - 1) * workspaceSize.gap > workspaceContentWidth
  const [activeSurfaceId, setActiveSurfaceId] = useState(() => orderedSurfaces[0]?.id ?? 'main')
  const activeSurface = orderedSurfaces.find(surface => surface.id === activeSurfaceId) ?? orderedSurfaces[0]
  const viewerActions = useDisplayViewerActions({
    applicationId,
    orderedSurfaces,
    onSurfacesChanged,
    setActiveSurfaceId
  })
  const clearStreamStatus = useCallback((surfaceId: string) => {
    const timer = streamStatusTimersRef.current[surfaceId]
    if (timer !== undefined) window.clearTimeout(timer)
    delete streamStatusTimersRef.current[surfaceId]
    setStreamStatuses(current => ({ ...current, [surfaceId]: undefined }))
  }, [])
  const viewerRetry = useDisplayViewerRetry({
    surfaces,
    surfaceRefreshVersion,
    refreshSurfaces: viewerActions.refreshSurfaces,
    clearStatus: clearStreamStatus
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
    const surfaceIds = new Set(orderedSurfaces.map(surface => surface.id))
    const nextSurfaceSessionIds = Object.fromEntries(orderedSurfaces.map(surface => [surface.id, surface.sessionId]))
    const surfaceSessionChanged = (surfaceId: string) =>
      surfaceSessionIdsRef.current[surfaceId] !== undefined &&
      surfaceSessionIdsRef.current[surfaceId] !== nextSurfaceSessionIds[surfaceId]
    setStreamStatuses(current =>
      Object.fromEntries(
        Object.entries(current).filter(([surfaceId]) => surfaceIds.has(surfaceId) && !surfaceSessionChanged(surfaceId))
      )
    )
    setStreamSizes(current =>
      Object.fromEntries(
        Object.entries(current).filter(([surfaceId]) => surfaceIds.has(surfaceId) && !surfaceSessionChanged(surfaceId))
      )
    )
    for (const [surfaceId, timer] of Object.entries(streamStatusTimersRef.current)) {
      if ((!surfaceIds.has(surfaceId) || surfaceSessionChanged(surfaceId)) && timer !== undefined) {
        window.clearTimeout(timer)
        delete streamStatusTimersRef.current[surfaceId]
      }
    }
    surfaceSessionIdsRef.current = nextSurfaceSessionIds
  }, [orderedSurfaces])

  useEffect(
    () => () => {
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current)
      }
      for (const timer of Object.values(streamStatusTimersRef.current)) {
        if (timer !== undefined) {
          window.clearTimeout(timer)
        }
      }
    },
    []
  )

  useLayoutEffect(() => {
    const container = scrollContainerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return
    }

    const track = container.querySelector('[data-display-track]')
    const updateSize = () => {
      const style = getComputedStyle(container)
      setWorkspaceSize({
        width: container.clientWidth,
        height: container.clientHeight,
        railWidth: Number.parseFloat(style.getPropertyValue('--viewer-rail-width')) || viewerControlRailWidth,
        chromeHeight: Number.parseFloat(style.getPropertyValue('--viewer-chrome-height')) || surfaceChromeHeight,
        headerSpace: Number.parseFloat(style.getPropertyValue('--viewer-display-header-space')) || 40,
        gap: track ? Number.parseFloat(getComputedStyle(track).columnGap) || 0 : 0
      })
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    updateSize()

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
    if (!compactSwitcher || !container) {
      return
    }

    // Compare reachable snap positions. With slight overflow neither display may be able to center.
    let nearestSurfaceId = activeSurface?.id
    let nearestDistance = Infinity
    for (const surface of orderedSurfaces) {
      const element = surfaceElementsRef.current[surface.id]
      if (!element) continue
      const distance = Math.abs(getSurfaceScrollLeft(container, element) - container.scrollLeft)
      if (distance < nearestDistance || (distance === nearestDistance && surface.id === activeSurface?.id)) {
        nearestDistance = distance
        nearestSurfaceId = surface.id
      }
    }
    if (nearestSurfaceId) setActiveSurfaceId(nearestSurfaceId)
  }

  const handleWorkspaceScroll = () => {
    if (!compactSwitcher) return
    if (scrollSettleTimerRef.current !== null) {
      window.clearTimeout(scrollSettleTimerRef.current)
    }

    scrollSettleTimerRef.current = window.setTimeout(syncActiveSurfaceFromScroll, 120)
  }

  const activeDisplayId = activeSurface?.id
  useLayoutEffect(() => {
    if (!compactSwitcher) {
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current)
        scrollSettleTimerRef.current = null
      }
      return
    }
    if (!activeDisplayId) return
    const workspace = scrollContainerRef.current
    const surface = surfaceElementsRef.current[activeDisplayId]
    if (!workspace || !surface) return

    workspace.scrollTo({
      left: getSurfaceScrollLeft(workspace, surface),
      behavior: 'instant'
    })
  }, [activeDisplayId, compactSwitcher, viewportSizes, workspaceContentWidth])

  const toggleKeyboardCapture = () => {
    setKeyboardCaptureEnabled(current => {
      const nextEnabled = !current
      onKeyboardCaptureChange?.(nextEnabled)
      return nextEnabled
    })
  }

  const setSurfaceStreamStatus = (surfaceId: string, status: ViewerStreamStatus) => {
    const surface = surfaces.find(item => item.id === surfaceId)
    if (!surface || (status.sessionId && status.sessionId !== surface.sessionId)) return
    if (status.code === 'session-expired' || status.code === 'session-ready') {
      if (!status.sessionId) return
      if (status.code === 'session-ready') {
        clearStreamStatus(surfaceId)
        sessionRecovery.presented(applicationId, surface)
        if (surface.kind === 'main') onFirstFrame?.(status.startup)
        return
      }
      if (sessionRecovery.request(applicationId, surface, surfaces)) viewerActions.refreshSurfaces()
    }

    if (status.blocking || status.failureStage || status.closeCode) onStreamIssue?.(surfaceId, status)

    const existingTimer = streamStatusTimersRef.current[surfaceId]
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer)
      delete streamStatusTimersRef.current[surfaceId]
    }

    setStreamStatuses(current => {
      if (current[surfaceId]?.blocking && !status.blocking) return current
      if (current[surfaceId]?.code === 'reconnecting' && status.code === 'audio-disabled') return current
      return { ...current, [surfaceId]: status }
    })

    if (!status.blocking && transientStreamStatusCodes.has(status.code)) {
      streamStatusTimersRef.current[surfaceId] = window.setTimeout(() => {
        delete streamStatusTimersRef.current[surfaceId]
        setStreamStatuses(current => {
          if (current[surfaceId] !== status) {
            return current
          }

          return {
            ...current,
            [surfaceId]: undefined
          }
        })
      }, transientStreamStatusTtlMs)
    }
  }

  const setSurfaceStreamMetrics = (surfaceId: string, metrics: ViewerStreamMetricsV4) => {
    const { width, height } = metrics
    if (width && width > 0 && height && height > 0) {
      setStreamSizes(current => {
        const previous = current[surfaceId]
        return previous?.width === width && previous.height === height
          ? current
          : { ...current, [surfaceId]: { width, height } }
      })
    }
    onStreamMetrics?.(surfaceId, metrics)
  }

  return {
    activeSurface,
    compactSwitcher,
    multipleDisplays,
    viewportSizes,
    fullscreen,
    fullscreenElement,
    fullscreenSurfaceId,
    keyboardCaptureEnabled,
    orderedSurfaces,
    streamSizes,
    scrollContainerRef,
    setSurfaceStreamMetrics,
    setSurfaceStreamStatus,
    surfaceViewportElementsRef,
    streamStatuses,
    viewerActions,
    viewerRetry,
    windowSize,
    workspaceSize,
    handleWorkspaceScroll,
    setActiveSurfaceId,
    surfaceElementsRef,
    toggleFullscreen,
    toggleKeyboardCapture
  }
}
