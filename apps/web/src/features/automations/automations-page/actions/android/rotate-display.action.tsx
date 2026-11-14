import { SelectField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const displayOrientations = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'reverse-portrait', label: 'Reverse portrait' },
  { value: 'reverse-landscape', label: 'Reverse landscape' }
]

export const rotateDisplayAction: AutomationActionDefinition = {
  uses: 'android.rotateDisplay',
  category: 'Device',
  iconKey: 'rotate',
  defaultInput: () => ({ orientation: 'landscape' }),
  normalizeInput: input => normalizeStringInput(input, 'orientation', 'landscape'),
  summary: input =>
    displayOrientations.find(option => option.value === stringInputValue(input, 'orientation', 'landscape'))?.label ??
    'Choose orientation',
  renderEditor: ({ input, patchInput }) => (
    <SelectField
      field='orientation'
      label='Orientation'
      value={stringInputValue(input, 'orientation', 'landscape')}
      options={displayOrientations}
      onChange={value => patchInput({ orientation: value })}
    />
  )
}
