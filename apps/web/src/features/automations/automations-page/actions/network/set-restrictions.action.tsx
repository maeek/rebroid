import { SelectField } from '../shared/action-fields'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const setRestrictionsAction: AutomationActionDefinition = {
  uses: 'container.network.setRestrictions',
  category: 'Network',
  iconKey: 'shield',
  defaultInput: () => ({}),
  summary: input =>
    typeof input.enabled === 'boolean'
      ? input.enabled
        ? 'Enable restrictions'
        : 'Disable restrictions'
      : 'Choose a network policy',
  renderEditor: ({ input, patchInput }) => (
    <SelectField
      field='enabled'
      label='Restrictions'
      value={typeof input.enabled === 'boolean' ? (input.enabled ? 'enabled' : 'disabled') : ''}
      options={[
        { value: 'enabled', label: 'Enable restrictions' },
        { value: 'disabled', label: 'Disable restrictions' }
      ]}
      onChange={value => patchInput({ enabled: value === 'enabled' })}
    />
  )
}
