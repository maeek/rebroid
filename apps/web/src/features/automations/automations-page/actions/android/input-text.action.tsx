import { createTextAction } from '../shared/definition-builders'

export const inputTextAction = createTextAction({
  uses: 'android.inputText',
  category: 'Text',
  iconKey: 'text',
  field: 'text',
  fieldLabel: 'Text to type',
  fieldDescription: 'Types into the focused Android field.',
  maskSummary: true,
  multiline: true
})
