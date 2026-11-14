import { DurationField } from '../shared/duration-field'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const waitAction: AutomationActionDefinition = {
  uses: 'android.wait',
  category: 'Device',
  iconKey: 'clock',
  defaultInput: () => ({ durationMs: 1000 }),
  normalizeInput: input => ({ durationMs: numberInputValue(input, 'durationMs', 1000) }),
  summary: input => `Wait ${numberInputValue(input, 'durationMs', 1000) / 1000} s`,
  renderEditor: ({ input, patchInput }) => (
    <DurationField
      input={input}
      label='Duration'
      fallback={1000}
      min={1}
      presets={[0.5, 1, 2, 5]}
      patchInput={patchInput}
    />
  )
}
