import { actionInputBinding } from '@rebroid/automation-core/command-registry'
import { Button } from '@/components/ui/button'
import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import { GesturePreview } from './gesture-preview'
import type { AutomationActionDefinition } from '../automation-action-definition'

const unitValue = (input: Record<string, unknown>, key: string) => numberInputValue(input, key, 0.5)

export const tapNormalizedAction: AutomationActionDefinition = {
  uses: 'android.tapNormalized',
  category: 'Touch',
  iconKey: 'click',
  defaultInput: () => ({ x: 0.5, y: 0.5 }),
  normalizeInput: input => ({
    x: unitValue(input, 'x'),
    y: unitValue(input, 'y')
  }),
  summary: input =>
    `${Number((unitValue(input, 'x') * 100).toPrecision(12))}% across, ${Number((unitValue(input, 'y') * 100).toPrecision(12))}% down`,
  renderEditor: ({ input, patchInput }) => {
    const point = { x: unitValue(input, 'x'), y: unitValue(input, 'y') }
    const linked = actionInputBinding(input.x) || actionInputBinding(input.y)
    return (
      <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]'>
        <div className='grid content-start gap-3'>
          <div className='grid grid-cols-2 gap-3'>
            {(['x', 'y'] as const).map(axis => (
              <NumberField
                key={axis}
                field={axis}
                label={axis === 'x' ? 'Across' : 'Down'}
                suffix='%'
                min={0}
                max={100}
                step='any'
                value={Number((point[axis] * 100).toPrecision(12))}
                onChange={value => patchInput({ [axis]: value / 100 })}
              />
            ))}
          </div>
          {!linked ? (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='justify-self-start'
              onClick={() => patchInput({ x: 0.5, y: 0.5 })}
            >
              Center
            </Button>
          ) : null}
        </div>
        {linked ? null : <GesturePreview start={point} />}
      </div>
    )
  }
}
