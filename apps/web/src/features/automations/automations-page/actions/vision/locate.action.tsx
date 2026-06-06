import { NumberField, TextField } from '../shared/action-fields'
import { numberInputValue, stringInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const visionLocateAction: AutomationActionDefinition = {
  uses: 'vision.locate',
  category: 'Vision',
  iconKey: 'search',
  label: 'Locate on screen',
  defaultInput: () => ({ query: '', threshold: 0.5, maxResults: 5 }),
  normalizeInput: input => ({
    query: stringInputValue(input, 'query'),
    threshold: Math.min(1, Math.max(0, numberInputValue(input, 'threshold', 0.5))),
    maxResults: Math.min(50, Math.max(1, numberInputValue(input, 'maxResults', 5)))
  }),
  summary: input => stringInputValue(input, 'query') || 'No query',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        label='Query'
        value={stringInputValue(input, 'query')}
        onChange={query => patchInput({ query })}
      />
      <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3'>
        <NumberField
          label='Threshold'
          value={numberInputValue(input, 'threshold', 0.5)}
          onChange={threshold => patchInput({ threshold })}
        />
        <NumberField
          label='Max results'
          value={numberInputValue(input, 'maxResults', 5)}
          onChange={maxResults => patchInput({ maxResults })}
        />
      </div>
    </div>
  )
}
