export const keyboardCaptureMessageType = 'rebroid-viewer-keyboard-capture'
export const keyboardEventMessageType = 'rebroid-viewer-keyboard-event'
export const viewerControlCommandEventType = 'rebroid-viewer-control-command'
export const viewerControlMessageType = 'rebroid-viewer-control-event'
export const viewerControlResultMessageType = 'rebroid-viewer-control-result'

export type ViewerControlCommandEventDetail = {
  command?: string
  surfaceId?: string
  onResult?: (error?: string) => void
}

type ViewerKeyboardRelayOptions = {
  getTargetOrigin: () => string
  getTargetWindow: () => Window | null | undefined
  isEnabled: () => boolean
}

const editableKeyboardTargetTags = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

const isEditableKeyboardTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (editableKeyboardTargetTags.has(target.tagName) || target.isContentEditable)

const viewerKeyboardEventMessage = (event: KeyboardEvent) => ({
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
})

export const addViewerKeyboardRelay = ({ getTargetOrigin, getTargetWindow, isEnabled }: ViewerKeyboardRelayOptions) => {
  const pressed = new Map<
    string,
    { target: Window; origin: string; message: ReturnType<typeof viewerKeyboardEventMessage> }
  >()
  const relayKeyboardEvent = (event: KeyboardEvent) => {
    const key = event.code || event.key
    const held = pressed.get(key)
    if (event.type === 'keyup') {
      if (!held) return
      pressed.delete(key)
      if (held.target === getTargetWindow()) held.target.postMessage(viewerKeyboardEventMessage(event), held.origin)
    } else {
      if (!isEnabled() || isEditableKeyboardTarget(event.target)) return
      const target = getTargetWindow()
      if (!target) return
      const origin = getTargetOrigin()
      const message = viewerKeyboardEventMessage(event)
      pressed.set(key, { target, origin, message })
      target.postMessage(message, origin)
    }

    if (!isEditableKeyboardTarget(event.target)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  window.addEventListener('keydown', relayKeyboardEvent, true)
  window.addEventListener('keyup', relayKeyboardEvent, true)

  return () => {
    window.removeEventListener('keydown', relayKeyboardEvent, true)
    window.removeEventListener('keyup', relayKeyboardEvent, true)
    const mountedTarget = getTargetWindow()
    for (const { target, origin, message } of pressed.values()) {
      if (target === mountedTarget) target.postMessage({ ...message, eventType: 'keyup', repeat: false }, origin)
    }
    pressed.clear()
  }
}
