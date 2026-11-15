import { SelectField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'
import type { ViewerCommand } from '@rebroid/android-application-core/viewer-control'

const controls = {
  back: 'Go back',
  home: 'Go to Home',
  recents: 'Show recent apps',
  wake: 'Wake display',
  sleep: 'Put display to sleep',
  power: 'Press Power',
  rotate: 'Rotate current display',
  'volume-up': 'Volume up',
  'volume-down': 'Volume down',
  mute: 'Mute',
  'expand-settings': 'Show quick settings',
  'collapse-panels': 'Close Android panels'
} satisfies Record<ViewerCommand, string>
const options = Object.entries(controls).map(([value, label]) => ({ value, label }))

export const viewerCommandAction: AutomationActionDefinition = {
  uses: 'android.viewerCommand',
  category: 'Device',
  iconKey: 'device',
  defaultInput: () => ({ command: 'wake' }),
  normalizeInput: input => normalizeStringInput(input, 'command', 'wake'),
  summary: input =>
    options.find(option => option.value === stringInputValue(input, 'command', 'wake'))?.label ?? 'Choose a control',
  renderEditor: ({ input, patchInput }) => (
    <SelectField
      field='command'
      label='Control'
      value={stringInputValue(input, 'command', 'wake')}
      options={options}
      onChange={value => patchInput({ command: value })}
    />
  )
}
