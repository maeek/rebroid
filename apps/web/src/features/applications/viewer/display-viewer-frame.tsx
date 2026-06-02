'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  addViewerKeyboardRelay,
  keyboardCaptureMessageType,
  keyboardEventMessageType,
  viewerControlMessageType
} from '@/features/applications/viewer/viewer-keyboard-relay'

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

const isViewerControlMessage = (value: unknown): value is { type: string; command: string } => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return record.type === viewerControlMessageType && typeof record.command === 'string'
}

export const DisplayViewerFrame = ({
  src,
  keyboardCaptureEnabled
}: {
  src: string
  keyboardCaptureEnabled: boolean
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const enabledRef = useRef(keyboardCaptureEnabled)
  const viewerOriginRef = useRef<string | null>(null)

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
    enabledRef.current = keyboardCaptureEnabled
    return scheduleKeyboardCaptureSync(keyboardCaptureEnabled)
  }, [keyboardCaptureEnabled, scheduleKeyboardCaptureSync])

  useEffect(() => {
    try {
      viewerOriginRef.current = new URL(src, window.location.href).origin
    } catch {
      viewerOriginRef.current = window.location.origin
    }
  }, [src])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const viewerOrigin = getViewerOrigin()
      if (event.origin !== viewerOrigin || !isKeyboardCaptureMessage(event.data)) {
        if (
          event.origin === viewerOrigin &&
          (isKeyboardEventMessage(event.data) || isViewerControlMessage(event.data))
        ) {
          iframeRef.current?.contentWindow?.postMessage(event.data, viewerOrigin)
        }
        return
      }

      enabledRef.current = event.data.enabled
      postKeyboardCapturePreference(event.data.enabled)
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [getViewerOrigin, postKeyboardCapturePreference])

  useEffect(() => {
    return addViewerKeyboardRelay({
      getTargetOrigin: getViewerOrigin,
      getTargetWindow: () => iframeRef.current?.contentWindow,
      isEnabled: () => enabledRef.current
    })
  }, [getViewerOrigin])

  return (
    <iframe
      ref={iframeRef}
      title='display viewer'
      src={src}
      className='h-screen w-screen border-0 bg-black'
      allow='fullscreen; clipboard-write; autoplay'
      onContextMenu={event => event.preventDefault()}
      onLoad={() => {
        scheduleKeyboardCaptureSync(enabledRef.current)
      }}
    />
  )
}
