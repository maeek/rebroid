import { SegmentedField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const displayOrientations = ['portrait', 'landscape', 'reverse-portrait', 'reverse-landscape']

export const rotateDisplayAction: AutomationActionDefinition = {
  uses: 'android.rotateDisplay',
  category: 'Device',
  iconKey: 'rotate',
  defaultInput: () => ({ orientation: 'landscape' }),
  normalizeInput: input => normalizeStringInput(input, 'orientation', 'landscape'),
  summary: input => stringInputValue(input, 'orientation', 'landscape'),
  renderEditor: ({ input, patchInput }) => (
    <SegmentedField
      label='Orientation'
      value={stringInputValue(input, 'orientation', 'landscape')}
      options={displayOrientations}
      onChange={value => patchInput({ orientation: value })}
    />
  )
}
