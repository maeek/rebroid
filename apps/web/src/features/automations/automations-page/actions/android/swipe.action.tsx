import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const swipeAction: AutomationActionDefinition = {
  uses: 'android.swipe',
  category: 'Touch',
  iconKey: 'swipe',
  defaultInput: () => ({ x1: 100, y1: 800, x2: 100, y2: 200, durationMs: 300 }),
  normalizeInput: input => ({
    x1: numberInputValue(input, 'x1', 100),
    y1: numberInputValue(input, 'y1', 800),
    x2: numberInputValue(input, 'x2', 100),
    y2: numberInputValue(input, 'y2', 200),
    durationMs: numberInputValue(input, 'durationMs', 300)
  }),
  summary: input =>
    `(${numberInputValue(input, 'x1', 100)}, ${numberInputValue(input, 'y1', 800)}) → (${numberInputValue(input, 'x2', 100)}, ${numberInputValue(input, 'y2', 200)}) px`,
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-4'>
      <p className='text-sm text-foreground-muted'>Measured from the top-left corner of the Android display.</p>
      <div className='grid grid-cols-2 gap-3'>
        {(
          [
            ['x1', 'Start X', 100],
            ['y1', 'Start Y', 800],
            ['x2', 'End X', 100],
            ['y2', 'End Y', 200]
          ] as const
        ).map(([field, label, fallback]) => (
          <NumberField
            key={field}
            field={field}
            label={label}
            suffix='px'
            step={1}
            min={0}
            value={numberInputValue(input, field, fallback)}
            onChange={value => patchInput({ [field]: value })}
          />
        ))}
      </div>
      <NumberField
        field='durationMs'
        label='Duration'
        suffix='ms'
        min={50}
        max={5000}
        step={1}
        value={numberInputValue(input, 'durationMs', 300)}
        onChange={durationMs => patchInput({ durationMs })}
      />
    </div>
  )
}
