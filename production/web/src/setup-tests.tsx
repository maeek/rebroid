import '@testing-library/jest-dom'
import 'whatwg-fetch'

global.Element.prototype.getAnimations = function () {
  return []
}
