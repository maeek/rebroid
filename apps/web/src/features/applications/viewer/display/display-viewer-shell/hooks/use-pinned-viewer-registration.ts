import { useLayoutEffect, useRef, useState } from 'react'
import { usePinnedViewer } from '@/features/applications/viewer/mini-player/pinned-viewer-context'
import type { useDisplayViewerSurface } from '../display-viewer-context'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export function usePinnedViewerRegistration(
  surface: DisplayViewerSurface,
  {
    applicationId,
    dockedSession,
    frameGeneration,
    displaySize,
    compact,
    canControl,
    canClipboard,
    isActive,
    keyboardCaptureEnabled,
    isRetrying,
    retryError,
    onStreamMetrics,
    onStreamStatus,
    onRetry,
    onSelect,
    onViewportElement
  }: ReturnType<typeof useDisplayViewerSurface>,
  viewerVisible: boolean
) {
  const pinnedViewer = usePinnedViewer()
  const register = pinnedViewer?.register
  const unregister = pinnedViewer?.unregister
  const managed = surface.kind === 'main' && Boolean(register && dockedSession)
  const active = viewerVisible && isActive
  const [registration] = useState(() => Symbol('viewer dock'))
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const callbacks = useRef({ onStreamStatus, onStreamMetrics, onRetry, onSelect })

  useLayoutEffect(() => {
    callbacks.current = { onStreamStatus, onStreamMetrics, onRetry, onSelect }
  })
  useLayoutEffect(() => {
    if (!managed || !viewport || !dockedSession) return
    register?.(registration, {
      appId: applicationId,
      ...dockedSession,
      element: viewport,
      surface,
      frameGeneration,
      displaySize,
      canControl,
      canClipboard: canClipboard === true,
      isActive: active,
      keyboardCaptureEnabled: viewerVisible && keyboardCaptureEnabled,
      onStreamMetrics: metrics => callbacks.current.onStreamMetrics(metrics),
      onStreamStatus: status => callbacks.current.onStreamStatus(status),
      onRetry: () => callbacks.current.onRetry(),
      onFocus: compact ? undefined : () => callbacks.current.onSelect(),
      retrying: isRetrying,
      retryError
    })
  }, [
    managed,
    viewport,
    register,
    registration,
    applicationId,
    dockedSession,
    surface,
    frameGeneration,
    displaySize,
    compact,
    canControl,
    canClipboard,
    active,
    viewerVisible,
    keyboardCaptureEnabled,
    isRetrying,
    retryError
  ])
  // Re-register in place when the surface changes so the provider keeps its iframe.
  useLayoutEffect(() => () => unregister?.(registration), [unregister, registration])

  const attachViewport = (element: HTMLDivElement | null) => {
    onViewportElement(element)
    if (managed && element) setViewport(element)
  }

  return { managed, pinnedViewer, attachViewport }
}
