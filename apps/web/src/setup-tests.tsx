import '@testing-library/jest-dom'
import 'whatwg-fetch'

if (!globalThis.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    pointerType: string

    constructor(type: string, eventInitDict: PointerEventInit = {}) {
      super(type, eventInitDict)
      this.pointerId = eventInitDict.pointerId ?? 1
      this.pointerType = eventInitDict.pointerType ?? 'mouse'
    }
  }

  globalThis.PointerEvent = PointerEventPolyfill as typeof PointerEvent
}

global.Element.prototype.getAnimations = function () {
  return []
}
