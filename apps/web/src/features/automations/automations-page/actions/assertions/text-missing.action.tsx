import { createTextAction } from '../shared/definition-builders'

export const textMissingAction = createTextAction({
  uses: 'assert.textMissing',
  category: 'Assertions',
  iconKey: 'x',
  field: 'text',
  fieldLabel: 'Text'
})
