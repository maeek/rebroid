import { NumberField } from '../shared/action-fields'
import { AdvancedActionFields } from '../shared/advanced-action-fields'
import { numberInputValue } from '../shared/input-values'
import { readVisionModelInput } from './vision-model-input'
import { VisionOverrides } from './vision-overrides'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const visionObserveAction: AutomationActionDefinition = {
  uses: 'vision.observe',
  category: 'Vision',
  iconKey: 'search',
  label: 'Observe screen',
  defaultInput: () => ({ maxDetections: 40 }),
  normalizeInput: input => ({
    ...readVisionModelInput(input),
    maxDetections: Math.min(100, Math.max(1, numberInputValue(input, 'maxDetections', 40)))
  }),
  summary: () => 'Returns detections, OCR results, and a vision summary when available.',
  renderEditor: ({ input, patchInput }) => (
    <AdvancedActionFields
      label='Detection and model options'
      summary={input.visionProviderId || input.visionModelId ? 'Model overrides' : undefined}
    >
      <NumberField
        field='maxDetections'
        label='Max detections'
        value={numberInputValue(input, 'maxDetections', 40)}
        onChange={maxDetections => patchInput({ maxDetections })}
      />
      <VisionOverrides
        input={input}
        patchInput={patchInput}
      />
    </AdvancedActionFields>
  )
}
