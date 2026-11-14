import { createTextAction } from '../shared/definition-builders'

export const deleteFileAction = createTextAction({
  uses: 'android.deleteFile',
  category: 'Files',
  iconKey: 'trash',
  field: 'path',
  fieldLabel: 'Android file path',
  fieldDescription: 'Deletes this file on the workflow target when the step runs.',
  placeholder: '/sdcard/Download/example.txt…'
})
