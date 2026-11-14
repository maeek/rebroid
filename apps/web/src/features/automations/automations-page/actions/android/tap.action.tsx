import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

export const tapAction: AutomationActionDefinition = {
  uses: 'android.tap',
  category: 'Touch',
  iconKey: 'click',
  defaultInput: () => ({ x: 100, y: 100 }),
  normalizeInput: input => ({
    x: numberInputValue(input, 'x', 100),
    y: numberInputValue(input, 'y', 100)
  }),
  summary: input => `(${numberInputValue(input, 'x', 100)}, ${numberInputValue(input, 'y', 100)}) px`,
  renderEditor: ({ input, patchInput }) => (
    <div className='grid gap-4'>
      <p className='text-sm text-foreground-muted'>Measured from the top-left corner of the Android display.</p>
      <div className='grid grid-cols-2 gap-3'>
        {(
          [
            ['x', 'X', 100],
            ['y', 'Y', 100]
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
    </div>
  )
}
