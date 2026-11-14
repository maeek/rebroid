import { NumberField, SelectField, TextField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { numberInputValue, stringInputValue } from '../shared/input-values'
import { readVisionModelInput } from './vision-model-input'
import { VisionOverrides } from './vision-overrides'
import type { AutomationActionDefinition } from '../automation-action-definition'

const fullRegion = { left: 0, top: 0, width: 1, height: 1 }
const regionFields = [
  ['left', 'From left'],
  ['top', 'From top'],
  ['width', 'Width'],
  ['height', 'Height']
] as const

export const visionLocateAction: AutomationActionDefinition = {
  uses: 'vision.locate',
  category: 'Vision',
  iconKey: 'search',
  label: 'Locate on screen',
  defaultInput: () => ({ query: '', threshold: 0.5, maxResults: 5 }),
  normalizeInput: input => ({
    ...readVisionModelInput(input),
    ...(input.region === undefined ? {} : { region: input.region }),
    query: stringInputValue(input, 'query'),
    threshold: Math.min(1, Math.max(0, numberInputValue(input, 'threshold', 0.5))),
    maxResults: Math.min(50, Math.max(1, numberInputValue(input, 'maxResults', 5)))
  }),
  summary: input => stringInputValue(input, 'query') || 'No query',
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-3'>
      <TextField
        field='query'
        label='Text or element to find'
        placeholder='Settings, Continue button…'
        value={stringInputValue(input, 'query')}
        onChange={query => patchInput({ query })}
      />
      <SelectField
        label='Search area'
        value={input.region ? 'region' : 'full'}
        options={[
          { value: 'full', label: 'Full screen' },
          { value: 'region', label: 'Custom region' }
        ]}
        onChange={value => patchInput({ region: value === 'region' ? fullRegion : undefined })}
      />
      {input.region && typeof input.region === 'object' ? (
        <div className='grid grid-cols-2 gap-3'>
          {regionFields.map(([key, label]) => {
            const stored: unknown = Reflect.get(input.region as object, key)
            const value = typeof stored === 'number' ? stored : fullRegion[key]
            return (
              <NumberField
                key={key}
                label={label}
                suffix='%'
                min={0}
                max={100}
                value={Number((value * 100).toPrecision(12))}
                onChange={percent =>
                  patchInput({ region: { ...fullRegion, ...(input.region as object), [key]: percent / 100 } })
                }
              />
            )
          })}
        </div>
      ) : null}
      <p className='text-sm text-foreground-muted'>
        Use Search outcome to branch on a match, no match, or an inconclusive search.
      </p>
      <AdvancedActionFields
        label='Search options'
        summary={input.visionProviderId || input.visionModelId ? 'Model overrides' : undefined}
      >
        <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-x-form-column gap-y-3'>
          <NumberField
            field='threshold'
            label='Minimum confidence'
            value={numberInputValue(input, 'threshold', 0.5)}
            onChange={threshold => patchInput({ threshold })}
          />
          <NumberField
            field='maxResults'
            label='Max results'
            value={numberInputValue(input, 'maxResults', 5)}
            onChange={maxResults => patchInput({ maxResults })}
          />
        </div>
        <VisionOverrides
          input={input}
          patchInput={patchInput}
        />
      </AdvancedActionFields>
    </div>
  )
}
