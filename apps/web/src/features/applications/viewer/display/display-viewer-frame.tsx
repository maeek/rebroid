'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  isDisplayViewerStreamMetrics,
  isDisplayViewerStreamStatus,
  type DisplayViewerStreamMetrics,
  type DisplayViewerStreamStatus
} from '@/features/applications/viewer/display/display-viewer-stream-status'
import {
  addViewerKeyboardRelay,
  keyboardCaptureMessageType,
  keyboardEventMessageType,
  viewerControlCommandEventType,
  viewerControlMessageType,
  viewerControlResultMessageType
} from '@/features/applications/viewer/player/viewer-keyboard-relay'
import type { ViewerControlCommandEventDetail } from '@/features/applications/viewer/player/viewer-keyboard-relay'

const isKeyboardCaptureMessage = (value: unknown): value is { type: string; enabled: boolean } => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return record.type === keyboardCaptureMessageType && typeof record.enabled === 'boolean'
}

const isKeyboardEventMessage = (value: unknown): value is { type: string; eventType: string } => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.type === keyboardEventMessageType &&
    (record.eventType === 'keydown' || record.eventType === 'keyup') &&
    typeof record.code === 'string'
  )
}

const isViewerControlMessage = (value: unknown): value is { type: string; command: string; surfaceId?: string } => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.type === viewerControlMessageType &&
    typeof record.command === 'string' &&
    (record.surfaceId === undefined || typeof record.surfaceId === 'string')
  )
}

const isViewerControlResult = (value: unknown): value is { requestId: string; ok: boolean; message?: string } => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.type === viewerControlResultMessageType &&
    typeof record.requestId === 'string' &&
    typeof record.ok === 'boolean' &&
    (record.message === undefined || typeof record.message === 'string')
  )
}

let nextControlRequest = 0

export const DisplayViewerFrame = ({
  src,
  keyboardCaptureEnabled,
  onStreamStatus,
  onStreamMetrics,
  surfaceId,
  isActive = true
}: {
  src: string
  keyboardCaptureEnabled: boolean
  onStreamStatus?: (status: DisplayViewerStreamStatus) => void
  onStreamMetrics?: (metrics: DisplayViewerStreamMetrics) => void
  surfaceId?: string
  isActive?: boolean
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const enabledRef = useRef(isActive && keyboardCaptureEnabled)
  const viewerOriginRef = useRef<string | null>(null)
  const pendingControls = useRef(new Map<string, (error?: string) => void>())

  const getViewerOrigin = useCallback(() => viewerOriginRef.current ?? window.location.origin, [])

  const postKeyboardCapturePreference = useCallback(
    (enabled: boolean) => {
      const targetWindow = iframeRef.current?.contentWindow
      if (!targetWindow) {
        return
      }

      targetWindow.postMessage(
        {
          type: keyboardCaptureMessageType,
          enabled
        },
        getViewerOrigin()
      )
    },
    [getViewerOrigin]
  )

  const scheduleKeyboardCaptureSync = useCallback(
    (enabled: boolean) => {
      const attempts = [0, 150, 400, 900]
      const timers = attempts.map(delay => window.setTimeout(() => postKeyboardCapturePreference(enabled), delay))

      return () => {
        timers.forEach(timer => window.clearTimeout(timer))
      }
    },
    [postKeyboardCapturePreference]
  )

  useEffect(() => {
    enabledRef.current = isActive && keyboardCaptureEnabled
    return scheduleKeyboardCaptureSync(enabledRef.current)
  }, [isActive, keyboardCaptureEnabled, scheduleKeyboardCaptureSync])

  useEffect(() => {
    try {
      viewerOriginRef.current = new URL(src, window.location.href).origin
    } catch {
      viewerOriginRef.current = window.location.origin
    }
    const pending = pendingControls.current
    return () => {
      for (const finish of pending.values()) finish('The viewer display changed.')
    }
  }, [src])

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const viewerOrigin = getViewerOrigin()
      const isFrameSource = event.source === iframeRef.current?.contentWindow
      if (event.origin === viewerOrigin && isFrameSource && isViewerControlResult(event.data)) {
        const failure = event.data.message || 'The viewer did not execute the command.'
        pendingControls.current.get(event.data.requestId)?.(event.data.ok ? undefined : failure)
        return
      }
      if (event.origin === viewerOrigin && isFrameSource && isDisplayViewerStreamStatus(event.data)) {
        onStreamStatus?.(event.data)
        return
      }
      if (event.origin === viewerOrigin && isFrameSource && isDisplayViewerStreamMetrics(event.data)) {
        onStreamMetrics?.(event.data)
        return
      }

      if (event.origin !== viewerOrigin || event.source !== window.parent || !isActive) return
      if (!isKeyboardCaptureMessage(event.data)) {
        if (
          (enabledRef.current && isKeyboardEventMessage(event.data)) ||
          (isViewerControlMessage(event.data) && (!event.data.surfaceId || event.data.surfaceId === surfaceId))
        ) {
          iframeRef.current?.contentWindow?.postMessage(event.data, viewerOrigin)
        }
        return
      }

      enabledRef.current = keyboardCaptureEnabled && event.data.enabled
      postKeyboardCapturePreference(enabledRef.current)
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [
    getViewerOrigin,
    isActive,
    keyboardCaptureEnabled,
    onStreamMetrics,
    onStreamStatus,
    postKeyboardCapturePreference,
    surfaceId
  ])

  useEffect(() => {
    const relayControlCommand = (event: Event) => {
      const customEvent = event as CustomEvent<ViewerControlCommandEventDetail>
      const command = customEvent.detail?.command
      const targetSurfaceId = customEvent.detail?.surfaceId
      const targetWindow = iframeRef.current?.contentWindow
      if (!command || !targetWindow || (targetSurfaceId ? targetSurfaceId !== surfaceId : !isActive)) {
        return
      }

      if (customEvent.defaultPrevented) return
      customEvent.preventDefault()
      const onResult = customEvent.detail.onResult
      const requestId = onResult ? String(++nextControlRequest) : undefined
      if (requestId && onResult) {
        const finish = (error?: string) => {
          window.clearTimeout(timer)
          pendingControls.current.delete(requestId)
          onResult(error)
        }
        const timer = window.setTimeout(() => finish('The viewer did not confirm the command.'), 9_000)
        pendingControls.current.set(requestId, finish)
      }
      targetWindow.postMessage(
        {
          type: viewerControlMessageType,
          command,
          requestId
        },
        getViewerOrigin()
      )
    }

    window.addEventListener(viewerControlCommandEventType, relayControlCommand)

    return () => {
      window.removeEventListener(viewerControlCommandEventType, relayControlCommand)
    }
  }, [getViewerOrigin, isActive, surfaceId])

  useEffect(() => {
    if (!isActive || !keyboardCaptureEnabled) return
    return addViewerKeyboardRelay({
      getTargetOrigin: getViewerOrigin,
      getTargetWindow: () => iframeRef.current?.contentWindow,
      isEnabled: () => enabledRef.current
    })
  }, [getViewerOrigin, isActive, keyboardCaptureEnabled])

  return (
    <iframe
      ref={iframeRef}
      title='display viewer'
      src={src}
      className='h-full w-full border-0 bg-black'
      allow='fullscreen; clipboard-write; autoplay'
      onContextMenu={event => event.preventDefault()}
      onLoad={() => postKeyboardCapturePreference(enabledRef.current)}
    />
  )
}
