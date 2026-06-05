import { useEffect } from 'react'
import type { RefObject } from 'react'
import {
  addViewerKeyboardRelay,
  keyboardCaptureMessageType,
  viewerControlCommandEventType,
  viewerControlMessageType
} from '@/features/applications/viewer/player/viewer-keyboard-relay'
import type { ViewerControlCommandEventDetail } from '@/features/applications/viewer/player/viewer-keyboard-relay'

export const postKeyboardCaptureState = (targetWindow: Window | null | undefined, enabled: boolean) => {
  targetWindow?.postMessage(
    {
      type: keyboardCaptureMessageType,
      enabled
    },
    window.location.origin
  )
}

export const useViewerControlRelay = (
  viewerSrc: string | null,
  viewerFrameRef: RefObject<HTMLIFrameElement | null>
) => {
  useEffect(() => {
    if (!viewerSrc || typeof window === 'undefined') {
      return
    }

    const relayControlCommand = (event: Event) => {
      const customEvent = event as CustomEvent<ViewerControlCommandEventDetail>
      const command = customEvent.detail?.command
      const targetSurfaceId = customEvent.detail?.surfaceId
      const targetWindow = viewerFrameRef.current?.contentWindow
      if (!command || targetSurfaceId || !targetWindow) {
        return
      }

      customEvent.preventDefault()
      targetWindow.postMessage(
        {
          type: viewerControlMessageType,
          command,
          surfaceId: 'main'
        },
        window.location.origin
      )
    }

    window.addEventListener(viewerControlCommandEventType, relayControlCommand)

    return () => {
      window.removeEventListener(viewerControlCommandEventType, relayControlCommand)
    }
  }, [viewerFrameRef, viewerSrc])
}

export const useKeyboardCaptureSync = (
  viewerSrc: string | null,
  viewerFrameRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!viewerSrc || typeof window === 'undefined') {
      return
    }

    const attempts = [0, 150, 400, 900]
    const timers = attempts.map(delay =>
      window.setTimeout(() => {
        postKeyboardCaptureState(viewerFrameRef.current?.contentWindow, enabled)
      }, delay)
    )

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [enabled, viewerFrameRef, viewerSrc])
}

export const useKeyboardRelay = (
  viewerSrc: string | null,
  viewerFrameRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!viewerSrc || !enabled || typeof window === 'undefined') {
      return
    }

    return addViewerKeyboardRelay({
      getTargetOrigin: () => window.location.origin,
      getTargetWindow: () => viewerFrameRef.current?.contentWindow,
      isEnabled: () => true
    })
  }, [enabled, viewerFrameRef, viewerSrc])
}
