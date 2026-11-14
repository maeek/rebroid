import { SelectField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { DurationField } from '../shared/duration-field'
import { booleanInputValue, normalizeStringInput, numberInputValue, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const launchPackageAction: AutomationActionDefinition = {
  uses: 'android.launchPackage',
  category: 'Device',
  iconKey: 'device',
  defaultInput: () => ({ packageName: '', timeoutMs: 10000, requireSuccess: false }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'packageName'),
    timeoutMs: numberInputValue(input, 'timeoutMs', 10000),
    requireSuccess: booleanInputValue(input, 'requireSuccess')
  }),
  summary: input => stringInputValue(input, 'packageName') || 'Choose an Android package',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        field='packageName'
        label='Android package ID'
        placeholder='com.example.app…'
        value={stringInputValue(input, 'packageName')}
        onChange={value => patchInput({ packageName: value })}
      />
      <SelectField
        field='requireSuccess'
        label='If the package cannot launch'
        value={booleanInputValue(input, 'requireSuccess') ? 'fail' : 'continue'}
        options={[
          { value: 'continue', label: 'Continue with launch result' },
          { value: 'fail', label: 'Fail the step' }
        ]}
        onChange={value => patchInput({ requireSuccess: value === 'fail' })}
      />
      <AdvancedActionFields
        label='Launch timeout'
        summary={input.timeoutMs !== undefined && input.timeoutMs !== 10000 ? 'Custom timeout' : undefined}
      >
        <DurationField
          input={input}
          field='timeoutMs'
          label='Timeout'
          fallback={10000}
          min={100}
          patchInput={patchInput}
        />
      </AdvancedActionFields>
    </div>
  )
}
