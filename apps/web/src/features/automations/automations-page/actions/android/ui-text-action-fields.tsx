import { NumberField, SelectField, TextField } from '../shared/action-fields'
import { normalizeStringInput, numberInputValue, stringInputValue } from '../shared/input-values'
import type { AutomationActionEditorProps } from '../automation-action-definition'

export const defaultUiTextInput = () => ({ text: '', match: 'exact', timeoutMs: 10000, intervalMs: 1000 })

export const normalizeUiTextInput = (input: Record<string, unknown>) => ({
  ...normalizeStringInput(input, 'text'),
  match: stringInputValue(input, 'match', 'exact'),
  timeoutMs: numberInputValue(input, 'timeoutMs', 10000),
  intervalMs: numberInputValue(input, 'intervalMs', 1000)
})

export function UiTextActionFields({ input, patchInput }: Pick<AutomationActionEditorProps, 'input' | 'patchInput'>) {
  return (
    <div className='grid gap-3'>
      <TextField
        label='Text'
        value={stringInputValue(input, 'text')}
        onChange={value => patchInput({ text: value })}
      />
      <SelectField
        label='Label match'
        value={stringInputValue(input, 'match', 'exact')}
        options={[
          { value: 'exact', label: 'Exact label' },
          { value: 'contains', label: 'Contains text' }
        ]}
        onChange={value => patchInput({ match: value })}
      />
      <div className='grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] gap-x-form-column gap-y-3'>
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
