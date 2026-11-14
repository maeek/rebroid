import { SelectField, TextField } from '../shared/action-fields'
import { normalizeStringInput, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const commonKeys = ['BACK', 'HOME', 'ENTER', 'TAB', 'ESCAPE', 'MENU', 'POWER', 'VOLUME_UP', 'VOLUME_DOWN']

export const keyAction: AutomationActionDefinition = {
  uses: 'android.key',
  category: 'Device',
  iconKey: 'keyboard',
  defaultInput: () => ({ key: 'ENTER' }),
  normalizeInput: input => normalizeStringInput(input, 'key', 'ENTER'),
  summary: input => stringInputValue(input, 'key', 'ENTER'),
  renderEditor: ({ input, patchInput }) => {
    const key = stringInputValue(input, 'key', 'ENTER')
    const selected = commonKeys.includes(key) ? key : 'custom'

    return (
      <div className='grid gap-3'>
        <SelectField
          field='key'
          label='Key'
          value={selected}
          options={[
            ...commonKeys.map(value => ({
              value,
              label: value
                .toLowerCase()
                .replace('_', ' ')
                .replace(/^./, letter => letter.toUpperCase())
            })),
            { value: 'custom', label: 'Custom Android key' }
          ]}
          onChange={value => patchInput({ key: value === 'custom' ? '' : value })}
        />
        {selected === 'custom' ? (
          <TextField
            label='Custom key'
            placeholder='KEYCODE_ENTER…'
            value={key}
            onChange={value => patchInput({ key: value })}
          />
        ) : null}
      </div>
    )
  }
}
