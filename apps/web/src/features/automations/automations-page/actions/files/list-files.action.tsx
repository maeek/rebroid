import { createTextAction } from '../shared/definition-builders'

export const listFilesAction = createTextAction({
  uses: 'android.listFiles',
  category: 'Files',
  iconKey: 'files',
  field: 'path',
  fieldLabel: 'Android directory path',
  fieldDescription: 'Returns the entries under this directory.',
  placeholder: '/sdcard/Download…'
})
