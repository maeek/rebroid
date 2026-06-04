import { createTextAction } from '../shared/definition-builders'

export const setClipboardAction = createTextAction({
  uses: 'android.setClipboard',
  category: 'Text',
  iconKey: 'message',
  field: 'text',
  fieldLabel: 'Text',
  multiline: true
})
