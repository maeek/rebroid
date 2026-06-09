import { SelectField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'
import { viewerCommands } from '@rebroid/application-core/viewer-control'

export const viewerCommandAction: AutomationActionDefinition = {
  uses: 'android.viewerCommand',
  category: 'Device',
  iconKey: 'device',
  defaultInput: () => ({ command: 'wake' }),
  normalizeInput: input => normalizeStringInput(input, 'command', 'wake'),
  summary: input => stringInputValue(input, 'command', 'wake'),
  renderEditor: ({ input, patchInput }) => (
    <SelectField
      label='Command'
      value={stringInputValue(input, 'command', 'wake')}
      options={[...viewerCommands]}
      onChange={value => patchInput({ command: value })}
    />
  )
}
