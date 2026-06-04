import { createTextAction } from '../shared/definition-builders'

export const assertFileExistsAction = createTextAction({
  uses: 'assert.fileExists',
  category: 'Assertions',
  iconKey: 'file-check',
  field: 'path',
  fieldLabel: 'Path'
})
