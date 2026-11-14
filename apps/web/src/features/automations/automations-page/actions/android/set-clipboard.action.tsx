import { createTextAction } from '../shared/definition-builders'

export const setClipboardAction = createTextAction({
  uses: 'android.setClipboard',
  category: 'Text',
  iconKey: 'message',
  field: 'text',
  fieldLabel: 'Clipboard text',
  fieldDescription: 'Replaces the Android clipboard contents.',
  maskSummary: true,
  multiline: true
})
