import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import 'whatwg-fetch'

afterEach(cleanup)

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
