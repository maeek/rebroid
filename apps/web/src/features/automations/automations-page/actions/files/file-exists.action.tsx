import { createTextAction } from '../shared/definition-builders'

export const fileExistsAction = createTextAction({
  uses: 'android.fileExists',
  category: 'Files',
  iconKey: 'file-check',
  field: 'path',
  fieldLabel: 'Android file path',
  fieldDescription: 'Returns an Exists value for use in a condition.',
  placeholder: '/sdcard/Download/example.txt…'
})
