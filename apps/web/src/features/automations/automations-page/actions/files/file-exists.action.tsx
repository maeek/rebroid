import { createTextAction } from '../shared/definition-builders'

export const fileExistsAction = createTextAction({
  uses: 'android.fileExists',
  category: 'Files',
  iconKey: 'file-check',
  field: 'path',
  fieldLabel: 'Path'
})
