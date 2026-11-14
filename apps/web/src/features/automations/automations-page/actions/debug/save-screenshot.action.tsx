import { createNoInputAction } from '../shared/definition-builders'

export const saveScreenshotAction = createNoInputAction({
  uses: 'artifact.saveScreenshot',
  category: 'Debug',
  iconKey: 'screenshot',
  noInputMessage: 'Captures a fresh screenshot for this step’s run result.'
})
