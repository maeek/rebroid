'use client'

import { useEffect, useRef } from 'react'

const keyboardCaptureMessageType = 'rebroid-viewer-keyboard-capture'
const keyboardEventMessageType = 'rebroid-viewer-keyboard-event'

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

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
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

  const getViewerOrigin = () => viewerOriginRef.current ?? window.location.origin

  const postKeyboardCapturePreference = (enabled: boolean) => {
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
  }

  const scheduleKeyboardCaptureSync = (enabled: boolean) => {
    const attempts = [0, 150, 400, 900]
    const timers = attempts.map(delay => window.setTimeout(() => postKeyboardCapturePreference(enabled), delay))

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }

  useEffect(() => {
    enabledRef.current = keyboardCaptureEnabled
    return scheduleKeyboardCaptureSync(keyboardCaptureEnabled)
  }, [keyboardCaptureEnabled])

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
        if (event.origin === viewerOrigin && isKeyboardEventMessage(event.data)) {
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
  }, [])

  useEffect(() => {
    const relayKeyboardEvent = (event: KeyboardEvent) => {
      if (!enabledRef.current || isEditableKeyboardTarget(event.target)) {
        return
      }

      const targetWindow = iframeRef.current?.contentWindow
      if (!targetWindow) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      targetWindow.postMessage(
        {
          type: keyboardEventMessageType,
          eventType: event.type,
          key: event.key,
          code: event.code,
          location: event.location,
          repeat: event.repeat,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          capsLock: event.getModifierState('CapsLock'),
          numLock: event.getModifierState('NumLock'),
          scrollLock: event.getModifierState('ScrollLock')
        },
        getViewerOrigin()
      )
    }

    window.addEventListener('keydown', relayKeyboardEvent, true)
    window.addEventListener('keyup', relayKeyboardEvent, true)

    return () => {
      window.removeEventListener('keydown', relayKeyboardEvent, true)
      window.removeEventListener('keyup', relayKeyboardEvent, true)
    }
  }, [])

  return (
    <iframe
      ref={iframeRef}
      title='display viewer'
      src={src}
      className='h-screen w-screen border-0 bg-black'
      allow='fullscreen; clipboard-read; clipboard-write; autoplay'
      onLoad={() => {
        scheduleKeyboardCaptureSync(enabledRef.current)
      }}
    />
  )
}
