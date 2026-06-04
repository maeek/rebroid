import { NumberField, TextareaField } from '../shared/action-fields'
import { normalizeStringInput, numberInputValue, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const adbShellAction: AutomationActionDefinition = {
  uses: 'android.adbShell',
  category: 'Device',
  iconKey: 'terminal',
  defaultInput: () => ({ command: '', timeoutMs: 15000 }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'command'),
    timeoutMs: numberInputValue(input, 'timeoutMs', 15000)
  }),
  summary: input => stringInputValue(input, 'command') || 'command:',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextareaField
        label='Command'
        value={stringInputValue(input, 'command')}
        onChange={value => patchInput({ command: value })}
      />
      <NumberField
        label='Timeout'
        suffix='ms'
        value={numberInputValue(input, 'timeoutMs', 15000)}
        onChange={value => patchInput({ timeoutMs: value })}
      />
    </div>
  )
}
