import { SelectField, TextField } from '../shared/action-fields'
import { stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const createTextAssertion = (uses: string, iconKey: 'check' | 'x'): AutomationActionDefinition => ({
  uses,
  category: 'Assertions',
  iconKey,
  defaultInput: () => ({ text: '' }),
  summary: input => stringInputValue(input, 'text') || 'No text',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-4'>
      <TextField
        label='Text'
        value={stringInputValue(input, 'text')}
        onChange={text => patchInput({ text })}
      />
      <SelectField
        label='Source'
        value={stringInputValue(input, 'source', 'label')}
        options={[
          { value: 'label', label: 'Visible label' },
          { value: 'xml', label: 'Raw hierarchy XML' }
        ]}
        onChange={source => patchInput({ source })}
      />
      <SelectField
        label='Match'
        value={stringInputValue(input, 'match', 'exact')}
        options={[
          { value: 'exact', label: 'Exact' },
          { value: 'contains', label: 'Contains' }
        ]}
        onChange={match => patchInput({ match })}
      />
    </div>
  )
})

export const textExistsAction = createTextAssertion('assert.textExists', 'check')
export const textMissingAction = createTextAssertion('assert.textMissing', 'x')
