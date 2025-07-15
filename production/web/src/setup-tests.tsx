/* eslint-disable import/no-extraneous-dependencies */
import '@testing-library/jest-dom'
import 'whatwg-fetch'

Object.defineProperty(window, 'location', {
  configurable: true,
  enumerable: true,
  value: new URL('https://localhost:3000/')
})

global.Element.prototype.getAnimations = function () {
  return []
}
