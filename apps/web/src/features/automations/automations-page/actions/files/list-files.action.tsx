import { createTextAction } from '../shared/definition-builders'

export const listFilesAction = createTextAction({
  uses: 'android.listFiles',
  category: 'Files',
  iconKey: 'files',
  field: 'path',
  fieldLabel: 'Path'
})
