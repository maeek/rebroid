import { NumberField, SegmentedField, TextField } from '../shared/action-fields'
import {
  booleanInputValue,
  normalizeBooleanInput,
  normalizeNumberInput,
  normalizeStringInput,
  numberInputValue,
  stringInputValue
} from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const listPackagesAction: AutomationActionDefinition = {
  uses: 'android.listPackages',
  category: 'Device',
  iconKey: 'search',
  defaultInput: () => ({ query: '', includeSystem: false, maxResults: 50, timeoutMs: 10000 }),
  normalizeInput: input => ({
    ...normalizeStringInput(input, 'query'),
    ...normalizeBooleanInput(input, 'includeSystem', false),
    ...normalizeNumberInput(input, 'maxResults', 50),
    ...normalizeNumberInput(input, 'timeoutMs', 10000)
  }),
  summary: input => {
    const query = stringInputValue(input, 'query')
    return query ? `query: ${query}` : 'installed packages'
  },
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        label='Package filter'
        value={stringInputValue(input, 'query')}
        onChange={value => patchInput({ query: value })}
      />
      <SegmentedField
        label='Package set'
        value={booleanInputValue(input, 'includeSystem', false) ? 'all' : 'third-party'}
        options={[
          { value: 'third-party', label: 'Third-party' },
          { value: 'all', label: 'All packages' }
        ]}
        onChange={value => patchInput({ includeSystem: value === 'all' })}
      />
      <NumberField
        label='Max results'
        value={numberInputValue(input, 'maxResults', 50)}
        onChange={value => patchInput({ maxResults: value })}
      />
      <NumberField
        label='Timeout'
        suffix='ms'
        value={numberInputValue(input, 'timeoutMs', 10000)}
        onChange={value => patchInput({ timeoutMs: value })}
      />
    </div>
  )
}
