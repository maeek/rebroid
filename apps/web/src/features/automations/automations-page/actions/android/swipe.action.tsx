import { NumberField, SegmentedField } from '../shared/action-fields'
import { percentToPixel, pixelToPercent } from '../shared/coordinate-helpers'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

type CoordinateMode = 'pixels' | 'percent'

const coordinateMode = (uiState: Record<string, unknown>): CoordinateMode =>
  uiState.coordinateMode === 'percent' ? 'percent' : 'pixels'

const swipePreset = (value: string): Record<string, number> => {
  switch (value) {
    case 'down':
      return { x1: 540, y1: 420, x2: 540, y2: 1500, durationMs: 300 }
    case 'left':
      return { x1: 880, y1: 960, x2: 180, y2: 960, durationMs: 300 }
    case 'right':
      return { x1: 180, y1: 960, x2: 880, y2: 960, durationMs: 300 }
    case 'up':
    default:
      return { x1: 540, y1: 1500, x2: 540, y2: 420, durationMs: 300 }
  }
}

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
  fromBackendInput: () => ({ coordinateMode: 'pixels' }),
  toBackendInput: input => ({
    x1: numberInputValue(input, 'x1', 100),
    y1: numberInputValue(input, 'y1', 800),
    x2: numberInputValue(input, 'x2', 100),
    y2: numberInputValue(input, 'y2', 200),
    durationMs: numberInputValue(input, 'durationMs', 300)
  }),
  summary: input =>
    `x1: ${numberInputValue(input, 'x1', 100)}, y1: ${numberInputValue(input, 'y1', 800)}, x2: ${numberInputValue(input, 'x2', 100)}`,
  renderEditor: ({ input, uiState, patchInput, patchUiState }) => {
    const mode = coordinateMode(uiState)
    const x1 = numberInputValue(input, 'x1', 100)
    const y1 = numberInputValue(input, 'y1', 800)
    const x2 = numberInputValue(input, 'x2', 100)
    const y2 = numberInputValue(input, 'y2', 200)

    return (
      <div className='grid gap-3'>
        <SegmentedField
          label='Preset'
          value='custom'
          options={[
            { value: 'up', label: 'Swipe up' },
            { value: 'down', label: 'Swipe down' },
            { value: 'left', label: 'Swipe left' },
            { value: 'right', label: 'Swipe right' }
          ]}
          onChange={value => patchInput(swipePreset(value))}
        />
        <SegmentedField
          label='Position mode'
          value={mode}
          options={['pixels', 'percent']}
          onChange={value => patchUiState({ coordinateMode: value })}
        />
        {mode === 'pixels' ? (
          <div className='grid grid-cols-2 gap-3'>
            <NumberField
              label='Start X'
              value={x1}
              onChange={value => patchInput({ x1: value })}
            />
            <NumberField
              label='Start Y'
              value={y1}
              onChange={value => patchInput({ y1: value })}
            />
            <NumberField
              label='End X'
              value={x2}
              onChange={value => patchInput({ x2: value })}
            />
            <NumberField
              label='End Y'
              value={y2}
              onChange={value => patchInput({ y2: value })}
            />
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-3'>
            <NumberField
              label='Start X (%)'
              value={pixelToPercent(x1, 'x')}
              onChange={value => patchInput({ x1: percentToPixel(value, 'x') })}
            />
            <NumberField
              label='Start Y (%)'
              value={pixelToPercent(y1, 'y')}
              onChange={value => patchInput({ y1: percentToPixel(value, 'y') })}
            />
            <NumberField
              label='End X (%)'
              value={pixelToPercent(x2, 'x')}
              onChange={value => patchInput({ x2: percentToPixel(value, 'x') })}
            />
            <NumberField
              label='End Y (%)'
              value={pixelToPercent(y2, 'y')}
              onChange={value => patchInput({ y2: percentToPixel(value, 'y') })}
            />
          </div>
        )}
        <NumberField
          label='Duration'
          suffix='ms'
          value={numberInputValue(input, 'durationMs', 300)}
          onChange={value => patchInput({ durationMs: value })}
        />
      </div>
    )
  }
}
