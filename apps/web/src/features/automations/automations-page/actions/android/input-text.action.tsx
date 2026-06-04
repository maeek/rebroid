import { createTextAction } from '../shared/definition-builders'

export const inputTextAction = createTextAction({
  uses: 'android.inputText',
  category: 'Text',
  iconKey: 'text',
  field: 'text',
  fieldLabel: 'Text',
  multiline: true
})
