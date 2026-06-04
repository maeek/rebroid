import { TextareaField, TextField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const pushFileAction: AutomationActionDefinition = {
  uses: 'android.pushFile',
  category: 'Files',
  iconKey: 'file-import',
  defaultInput: () => ({ path: '', contentBase64: '' }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'path'),
    ...normalizeStringInput(input, 'contentBase64')
  }),
  summary: input => stringInputValue(input, 'path') || 'path:',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        label='Path'
        value={stringInputValue(input, 'path')}
        onChange={value => patchInput({ path: value })}
      />
      <TextareaField
        label='Base64 content'
        value={stringInputValue(input, 'contentBase64')}
        onChange={value => patchInput({ contentBase64: value })}
      />
    </div>
  )
}
