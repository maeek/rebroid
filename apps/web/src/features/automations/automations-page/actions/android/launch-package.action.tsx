import { NumberField, TextField } from '../shared/action-fields'
import { normalizeStringInput, numberInputValue, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const launchPackageAction: AutomationActionDefinition = {
  uses: 'android.launchPackage',
  category: 'Device',
  iconKey: 'device',
  defaultInput: () => ({ packageName: '', timeoutMs: 10000 }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'packageName'),
    timeoutMs: numberInputValue(input, 'timeoutMs', 10000)
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
    </div>
  )
}
