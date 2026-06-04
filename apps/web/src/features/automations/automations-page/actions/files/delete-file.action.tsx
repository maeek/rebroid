import { createTextAction } from '../shared/definition-builders'

export const deleteFileAction = createTextAction({
  uses: 'android.deleteFile',
  category: 'Files',
  iconKey: 'trash',
  field: 'path',
  fieldLabel: 'Path'
})
