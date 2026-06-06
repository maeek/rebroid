import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const unitValue = (input: Record<string, unknown>, key: string, fallback: number) =>
  Math.min(1, Math.max(0, numberInputValue(input, key, fallback)))

export const tapNormalizedAction: AutomationActionDefinition = {
  uses: 'android.tapNormalized',
  category: 'Touch',
  iconKey: 'click',
  defaultInput: () => ({ x: 0.5, y: 0.5 }),
  normalizeInput: input => ({
    x: unitValue(input, 'x', 0.5),
    y: unitValue(input, 'y', 0.5)
  }),
  summary: input => `x: ${unitValue(input, 'x', 0.5)}, y: ${unitValue(input, 'y', 0.5)}`,
  renderEditor: ({ input, patchInput }) => (
    <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3'>
      <NumberField
        label='X'
        value={unitValue(input, 'x', 0.5)}
        onChange={x => patchInput({ x })}
      />
      <NumberField
        label='Y'
        value={unitValue(input, 'y', 0.5)}
        onChange={y => patchInput({ y })}
      />
    </div>
  )
}
