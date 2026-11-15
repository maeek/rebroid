import { SelectField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { createNoInputAction } from '../shared/definition-builders'
import { DurationField } from '../shared/duration-field'
import { stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const expandQuickSettingsAction = createNoInputAction({
  uses: 'android.expandQuickSettings',
  category: 'Device',
  iconKey: 'device',
  noInputMessage: 'Opens the Android Quick Settings panel.'
})
export const collapsePanelsAction = createNoInputAction({
  uses: 'android.collapsePanels',
  category: 'Device',
  iconKey: 'device',
  noInputMessage: 'Closes the open Android system panel.'
})

export const openSystemSettingsAction: AutomationActionDefinition = {
  uses: 'android.openSystemSettings',
  category: 'Device',
  iconKey: 'device',
  defaultInput: () => ({ screen: 'main', timeoutMs: 10000 }),
  summary: () => 'Main Settings screen',
  renderEditor: ({ input, patchInput }) => (
    <AdvancedActionFields
      label='Settings options'
      summary={input.timeoutMs !== undefined && input.timeoutMs !== 10000 ? 'Custom timeout' : undefined}
    >
      <SelectField
        field='screen'
        label='Settings screen'
        value={stringInputValue(input, 'screen', 'main')}
        options={[{ value: 'main', label: 'Main Settings screen' }]}
        onChange={screen => patchInput({ screen })}
      />
      <DurationField
        input={input}
        field='timeoutMs'
        label='Timeout'
        fallback={10000}
        min={100}
        patchInput={patchInput}
      />
    </AdvancedActionFields>
  )
}

export const getSettingAction: AutomationActionDefinition = {
  uses: 'android.getSetting',
  category: 'Device',
  iconKey: 'device',
  defaultInput: () => ({ namespace: 'system', key: '', timeoutMs: 10000 }),
  summary: input => stringInputValue(input, 'key') || 'Choose a setting',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-4'>
      <SelectField
        field='namespace'
        label='Namespace'
        value={stringInputValue(input, 'namespace', 'system')}
        options={[
          { value: 'system', label: 'System' },
          { value: 'secure', label: 'Secure' },
          { value: 'global', label: 'Global' }
        ]}
        onChange={namespace => patchInput({ namespace })}
      />
      <TextField
        field='key'
        label='Setting key'
        placeholder='screen_brightness…'
        value={stringInputValue(input, 'key')}
        onChange={key => patchInput({ key })}
      />
      <AdvancedActionFields
        label='Read timeout'
        summary={input.timeoutMs !== undefined && input.timeoutMs !== 10000 ? 'Custom timeout' : undefined}
      >
        <DurationField
          input={input}
          field='timeoutMs'
          label='Timeout'
          fallback={10000}
          min={100}
          patchInput={patchInput}
        />
      </AdvancedActionFields>
    </div>
  )
}
