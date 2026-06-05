import { NumberField, SegmentedField } from '../shared/action-fields'
import { percentToPixel, pixelToPercent } from '../shared/coordinate-helpers'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

type CoordinateMode = 'pixels' | 'percent'

const coordinateMode = (uiState: Record<string, unknown>): CoordinateMode =>
  uiState.coordinateMode === 'percent' ? 'percent' : 'pixels'

export const tapAction: AutomationActionDefinition = {
  uses: 'android.tap',
  category: 'Touch',
  iconKey: 'click',
  defaultInput: () => ({ x: 100, y: 100 }),
  normalizeInput: input => ({
    x: numberInputValue(input, 'x', 100),
    y: numberInputValue(input, 'y', 100)
  }),
  fromBackendInput: () => ({ coordinateMode: 'pixels' }),
  toBackendInput: input => ({
    x: numberInputValue(input, 'x', 100),
    y: numberInputValue(input, 'y', 100)
  }),
  summary: input => `x: ${numberInputValue(input, 'x', 100)}, y: ${numberInputValue(input, 'y', 100)}`,
  renderEditor: ({ input, uiState, patchInput, patchUiState }) => {
    const mode = coordinateMode(uiState)
    const x = numberInputValue(input, 'x', 100)
    const y = numberInputValue(input, 'y', 100)

    return (
      <div className='grid gap-3'>
        <SegmentedField
          label='Position mode'
          value={mode}
          options={['pixels', 'percent']}
          onChange={value => patchUiState({ coordinateMode: value })}
        />
        {mode === 'pixels' ? (
          <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3'>
            <NumberField
              label='X'
              value={x}
              onChange={value => patchInput({ x: value })}
            />
            <NumberField
              label='Y'
              value={y}
              onChange={value => patchInput({ y: value })}
            />
          </div>
        ) : (
          <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3'>
            <NumberField
              label='X (%)'
              value={pixelToPercent(x, 'x')}
              onChange={value => patchInput({ x: percentToPixel(value, 'x') })}
            />
            <NumberField
              label='Y (%)'
              value={pixelToPercent(y, 'y')}
              onChange={value => patchInput({ y: percentToPixel(value, 'y') })}
            />
          </div>
        )}
      </div>
    )
  }
}
