import { TextareaField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { DurationField } from '../shared/duration-field'
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
  summary: input => (stringInputValue(input, 'command') ? 'Custom Android shell command' : 'Enter a command'),
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextareaField
        field='command'
        label='Android shell command'
        placeholder='getprop ro.build.version.release…'
        className='font-mono'
        description='Runs on the selected Android device.'
        value={stringInputValue(input, 'command')}
        onChange={value => patchInput({ command: value })}
      />
      <AdvancedActionFields
        label='Command timeout'
        summary={input.timeoutMs !== undefined && input.timeoutMs !== 15000 ? 'Custom timeout' : undefined}
      >
        <DurationField
          input={input}
          field='timeoutMs'
          label='Timeout'
          fallback={15000}
          min={100}
          patchInput={patchInput}
        />
      </AdvancedActionFields>
    </div>
  )
}
