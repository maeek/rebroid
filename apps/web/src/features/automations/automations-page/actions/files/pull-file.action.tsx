import { createTextAction } from '../shared/definition-builders'

export const pullFileAction = createTextAction({
  uses: 'android.pullFile',
  category: 'Files',
  iconKey: 'file-export',
  field: 'path',
  fieldLabel: 'Path'
})
