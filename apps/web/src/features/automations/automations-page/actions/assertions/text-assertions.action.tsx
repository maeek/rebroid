import { SelectField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
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
        field='text'
        label='Text'
        description={
          iconKey === 'check'
            ? 'Checks once and fails if the text is missing.'
            : 'Checks once and fails if the text is found.'
        }
        value={stringInputValue(input, 'text')}
        onChange={text => patchInput({ text })}
      />
      <SelectField
        field='match'
        label='Match'
        description={
          input.source === 'xml' ? 'Exact compares the entire XML document. Contains searches within it.' : undefined
        }
        value={stringInputValue(input, 'match', 'exact')}
        options={[
          { value: 'exact', label: 'Exact' },
          { value: 'contains', label: 'Contains' }
        ]}
        onChange={match => patchInput({ match })}
      />
      <AdvancedActionFields
        label='Search source'
        summary={input.source === 'xml' ? 'Raw hierarchy XML' : undefined}
      >
        <SelectField
          field='source'
          label='Search in'
          value={stringInputValue(input, 'source', 'label')}
          options={[
            { value: 'label', label: 'Visible labels' },
            { value: 'xml', label: 'Raw hierarchy XML' }
          ]}
          onChange={source => patchInput({ source })}
        />
      </AdvancedActionFields>
    </div>
  )
})

export const textExistsAction = createTextAssertion('assert.textExists', 'check')
export const textMissingAction = createTextAssertion('assert.textMissing', 'x')
