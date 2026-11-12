import { NumberField, SelectField, TextField } from '../shared/action-fields'
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
  summary: input => stringInputValue(input, 'packageName') || 'package:',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        label='Package name'
        value={stringInputValue(input, 'packageName')}
        onChange={value => patchInput({ packageName: value })}
      />
      <NumberField
        label='Timeout'
        suffix='ms'
        value={numberInputValue(input, 'timeoutMs', 10000)}
        onChange={value => patchInput({ timeoutMs: value })}
      />
      <SelectField
        label='If the package cannot launch'
        value={booleanInputValue(input, 'requireSuccess') ? 'fail' : 'continue'}
        options={[
          { value: 'continue', label: 'Continue with launch result' },
          { value: 'fail', label: 'Fail the step' }
        ]}
        onChange={value => patchInput({ requireSuccess: value === 'fail' })}
      />
    </div>
  )
}
