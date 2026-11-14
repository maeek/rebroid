import { createTextAction } from '../shared/definition-builders'

export const assertFileExistsAction = createTextAction({
  uses: 'assert.fileExists',
  category: 'Assertions',
  iconKey: 'file-check',
  field: 'path',
  fieldLabel: 'Android file path',
  fieldDescription: 'Fails the step if the file is missing.',
  placeholder: '/sdcard/Download/example.txt…'
})
