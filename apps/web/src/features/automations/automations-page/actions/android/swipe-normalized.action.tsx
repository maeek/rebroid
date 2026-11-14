import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import { GesturePreview, type RelativePoint } from './gesture-preview'
import type { AutomationActionDefinition } from '../automation-action-definition'

const directions = [
  { label: 'Up', icon: IconArrowUp, start: { x: 0.5, y: 0.8 }, end: { x: 0.5, y: 0.2 } },
  { label: 'Down', icon: IconArrowDown, start: { x: 0.5, y: 0.2 }, end: { x: 0.5, y: 0.8 } },
  { label: 'Left', icon: IconArrowLeft, start: { x: 0.8, y: 0.5 }, end: { x: 0.2, y: 0.5 } },
  { label: 'Right', icon: IconArrowRight, start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 } }
] as const

const pointValue = (value: unknown, fallback: RelativePoint): RelativePoint => {
  if (!value || typeof value !== 'object') return fallback
  const x: unknown = Reflect.get(value, 'x')
  const y: unknown = Reflect.get(value, 'y')
  return { x: typeof x === 'number' ? x : fallback.x, y: typeof y === 'number' ? y : fallback.y }
}

const readPoints = (input: Record<string, unknown>) => ({
  start: pointValue(input.start, directions[0].start),
  end: pointValue(input.end, directions[0].end)
})

const matchingDirection = (start: RelativePoint, end: RelativePoint) =>
  directions.find(
    direction =>
      direction.start.x === start.x &&
      direction.start.y === start.y &&
      direction.end.x === end.x &&
      direction.end.y === end.y
  )

export const swipeNormalizedAction: AutomationActionDefinition = {
  uses: 'android.swipeNormalized',
  category: 'Touch',
  iconKey: 'swipe',
  defaultInput: () => ({ start: directions[0].start, end: directions[0].end, durationMs: 300 }),
  normalizeInput: input => ({ ...readPoints(input), durationMs: numberInputValue(input, 'durationMs', 300) }),
  summary: input => {
    const { start, end } = readPoints(input)
    const direction = matchingDirection(start, end)
    const duration = numberInputValue(input, 'durationMs', 300)
    return `${direction ? `Swipe ${direction.label.toLowerCase()}` : 'Custom swipe'} · ${duration} ms`
  },
  renderEditor: ({ input, patchInput, patchUiState, uiState }) => {
    const { start, end } = readPoints(input)
    const direction = matchingDirection(start, end)
    const custom = uiState.customSwipe === true || !direction

    return (
      <div className='grid min-w-0 gap-4'>
        <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]'>
          <div className='grid min-w-0 content-start gap-4'>
            <fieldset className='grid min-w-0 gap-2'>
              <legend className='mb-2 text-sm font-medium'>Finger direction</legend>
              <div className='flex flex-wrap gap-1'>
                {directions.map(({ label, icon: Icon, start: presetStart, end: presetEnd }) => (
                  <Button
                    key={label}
                    type='button'
                    size='sm'
                    variant={!custom && direction?.label === label ? 'secondary' : 'ghost'}
                    aria-pressed={!custom && direction?.label === label}
                    onClick={() => patchInput({ start: presetStart, end: presetEnd }, { customSwipe: false })}
                  >
                    <Icon
                      aria-hidden
                      className='size-4'
                    />
                    {label}
                  </Button>
                ))}
                <Button
                  type='button'
                  size='sm'
                  variant={custom ? 'secondary' : 'ghost'}
                  aria-pressed={custom}
                  onClick={() => patchUiState({ customSwipe: true })}
                >
                  Custom
                </Button>
              </div>
            </fieldset>
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
          <GesturePreview
            start={start}
            end={end}
          />
        </div>
        {custom ? (
          <div className='grid gap-4 pt-1'>
            {(
              [
                ['start', start],
                ['end', end]
              ] as const
            ).map(([name, point]) => (
              <fieldset
                key={name}
                className='grid grid-cols-2 gap-3'
              >
                <legend className='mb-2 text-sm font-medium capitalize'>{name} point</legend>
                {(['x', 'y'] as const).map(axis => (
                  <NumberField
                    key={axis}
                    label={`${name === 'start' ? 'Start' : 'End'} ${axis.toUpperCase()}`}
                    suffix='%'
                    min={0}
                    max={100}
                    value={Number((point[axis] * 100).toPrecision(12))}
                    onChange={value => patchInput({ [name]: { ...point, [axis]: value / 100 } })}
                  />
                ))}
              </fieldset>
            ))}
          </div>
        ) : null}
      </div>
    )
  }
}
