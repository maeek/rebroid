export const keyboardCaptureMessageType = 'rebroid-viewer-keyboard-capture'
export const keyboardEventMessageType = 'rebroid-viewer-keyboard-event'
export const viewerControlMessageType = 'rebroid-viewer-control-event'

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
  const relayKeyboardEvent = (event: KeyboardEvent) => {
    if (!isEnabled() || isEditableKeyboardTarget(event.target)) {
      return
    }

    const targetWindow = getTargetWindow()
    if (!targetWindow) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    targetWindow.postMessage(viewerKeyboardEventMessage(event), getTargetOrigin())
  }

  window.addEventListener('keydown', relayKeyboardEvent, true)
  window.addEventListener('keyup', relayKeyboardEvent, true)

  return () => {
    window.removeEventListener('keydown', relayKeyboardEvent, true)
    window.removeEventListener('keyup', relayKeyboardEvent, true)
  }
}
