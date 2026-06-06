import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const visionObserveAction: AutomationActionDefinition = {
  uses: 'vision.observe',
  category: 'Vision',
  iconKey: 'search',
  label: 'Observe screen',
  defaultInput: () => ({ maxDetections: 40 }),
  normalizeInput: input => ({
    maxDetections: Math.min(100, Math.max(1, numberInputValue(input, 'maxDetections', 40)))
  }),
  summary: input => `max detections: ${numberInputValue(input, 'maxDetections', 40)}`,
  renderEditor: ({ input, patchInput }) => (
    <NumberField
      label='Max detections'
      value={numberInputValue(input, 'maxDetections', 40)}
      onChange={maxDetections => patchInput({ maxDetections })}
    />
  )
}
