import { createTextAction } from '../shared/definition-builders'

export const pullFileAction = createTextAction({
  uses: 'android.pullFile',
  category: 'Files',
  iconKey: 'file-export',
  field: 'path',
  fieldLabel: 'Source file path',
  fieldDescription: 'Returns the file contents, path, and size.',
  placeholder: '/sdcard/Download/example.txt…'
})
