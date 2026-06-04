import { SelectField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const viewerCommands = [
  'back',
  'home',
  'recents',
  'wake',
  'power',
  'volume-up',
  'volume-down',
  'mute',
  'rotate',
  'expand-notifications',
  'expand-settings',
  'collapse-panels'
]

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
      options={viewerCommands}
      onChange={value => patchInput({ command: value })}
    />
  )
}
