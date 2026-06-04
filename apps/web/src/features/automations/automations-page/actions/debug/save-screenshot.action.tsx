import { createNoInputAction } from '../shared/definition-builders'

export const saveScreenshotAction = createNoInputAction({
  uses: 'artifact.saveScreenshot',
  category: 'Debug',
  iconKey: 'screenshot'
})
