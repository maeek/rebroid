import { createNoInputAction } from '../shared/definition-builders'

export const screenshotAction = createNoInputAction({
  uses: 'android.screenshot',
  category: 'Debug',
  iconKey: 'screenshot',
  noInputMessage: 'Returns the screen image, capture time, and media type.'
})
