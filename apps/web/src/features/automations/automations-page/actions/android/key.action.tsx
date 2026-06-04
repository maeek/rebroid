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
          label='Key'
          value={selected}
          options={[...commonKeys, 'custom']}
          onChange={value => patchInput({ key: value === 'custom' ? '' : value })}
        />
        {selected === 'custom' ? (
          <TextField
            label='Custom key'
            value={key}
            onChange={value => patchInput({ key: value })}
          />
        ) : null}
      </div>
    )
  }
}
