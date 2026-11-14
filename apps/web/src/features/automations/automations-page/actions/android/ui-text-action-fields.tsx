import { SelectField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { DurationField } from '../shared/duration-field'
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
        field='text'
        label='Text or accessibility label'
        value={stringInputValue(input, 'text')}
        onChange={value => patchInput({ text: value })}
      />
      <SelectField
        field='match'
        label='Label match'
        value={stringInputValue(input, 'match', 'exact')}
        options={[
          { value: 'exact', label: 'Exact label' },
          { value: 'contains', label: 'Contains text' }
        ]}
        onChange={value => patchInput({ match: value })}
      />
      <DurationField
        input={input}
        field='timeoutMs'
        label='Wait up to'
        fallback={10000}
        min={100}
        presets={[5, 10, 15, 30]}
        patchInput={patchInput}
      />
      <AdvancedActionFields
        label='Polling interval'
        summary={
          typeof input.intervalMs === 'number' && input.intervalMs !== 1000
            ? `Check every ${input.intervalMs / 1000} s`
            : undefined
        }
        open={typeof input.intervalMs === 'number' && (input.intervalMs < 250 || input.intervalMs > 10000)}
      >
        <DurationField
          input={input}
          field='intervalMs'
          label='Check every'
          fallback={1000}
          min={250}
          max={10000}
          patchInput={patchInput}
        />
      </AdvancedActionFields>
    </div>
  )
}
