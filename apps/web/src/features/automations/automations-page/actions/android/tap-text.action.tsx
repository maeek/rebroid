import { NumberField, TextField } from '../shared/action-fields'
import { normalizeStringInput, numberInputValue, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const tapTextAction: AutomationActionDefinition = {
  uses: 'android.tapText',
  category: 'Text',
  iconKey: 'click',
  defaultInput: () => ({ text: '', timeoutMs: 10000, intervalMs: 1000 }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'text'),
    timeoutMs: numberInputValue(input, 'timeoutMs', 10000),
    intervalMs: numberInputValue(input, 'intervalMs', 1000)
  }),
  summary: input => stringInputValue(input, 'text') || 'text:',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        label='Text'
        value={stringInputValue(input, 'text')}
        onChange={value => patchInput({ text: value })}
      />
      <div className='grid grid-cols-2 gap-3'>
        <NumberField
          label='Timeout'
          suffix='ms'
          value={numberInputValue(input, 'timeoutMs', 10000)}
          onChange={value => patchInput({ timeoutMs: value })}
        />
        <NumberField
          label='Interval'
          suffix='ms'
          value={numberInputValue(input, 'intervalMs', 1000)}
          onChange={value => patchInput({ intervalMs: value })}
        />
      </div>
    </div>
  )
}
