/* eslint-disable import/no-extraneous-dependencies */
import '@testing-library/jest-dom'
import 'whatwg-fetch'

global.Element.prototype.getAnimations = function () {
  return []
}
