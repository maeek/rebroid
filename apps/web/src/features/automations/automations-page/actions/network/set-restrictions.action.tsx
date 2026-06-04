import { SegmentedField } from '../shared/action-fields'
import { booleanInputValue, normalizeBooleanInput } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const setRestrictionsAction: AutomationActionDefinition = {
  uses: 'container.network.setRestrictions',
  category: 'Network',
  iconKey: 'shield',
  defaultInput: () => ({ enabled: false }),
  normalizeInput: input => normalizeBooleanInput(input, 'enabled'),
  summary: input => (booleanInputValue(input, 'enabled') ? 'enabled' : 'disabled'),
  renderEditor: ({ input, patchInput }) => (
    <SegmentedField
      label='Restrictions'
      value={booleanInputValue(input, 'enabled') ? 'enabled' : 'disabled'}
      options={['enabled', 'disabled']}
      onChange={value => patchInput({ enabled: value === 'enabled' })}
    />
  )
}
