import { createTextAction } from '../shared/definition-builders'

export const textExistsAction = createTextAction({
  uses: 'assert.textExists',
  category: 'Assertions',
  iconKey: 'check',
  field: 'text',
  fieldLabel: 'Text'
})
