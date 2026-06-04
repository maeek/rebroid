import { createNoInputAction } from '../shared/definition-builders'

export const getClipboardAction = createNoInputAction({
  uses: 'android.getClipboard',
  category: 'Text',
  iconKey: 'message'
})
