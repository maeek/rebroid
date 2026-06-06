import { NumberField } from '../shared/action-fields'
import { numberInputValue } from '../shared/input-values'
import type { AutomationActionDefinition } from '../automation-action-definition'

const pointValue = (input: Record<string, unknown>, key: string, fallback: { x: number; y: number }) => {
  const point = input[key]
  if (!point || typeof point !== 'object' || Array.isArray(point)) return fallback
  const record = point as Record<string, unknown>
  return {
    x: Math.min(1, Math.max(0, typeof record.x === 'number' ? record.x : fallback.x)),
    y: Math.min(1, Math.max(0, typeof record.y === 'number' ? record.y : fallback.y))
  }
}

export const swipeNormalizedAction: AutomationActionDefinition = {
  uses: 'android.swipeNormalized',
  category: 'Touch',
  iconKey: 'swipe',
  defaultInput: () => ({ start: { x: 0.5, y: 0.8 }, end: { x: 0.5, y: 0.2 }, durationMs: 300 }),
  normalizeInput: input => ({
    start: pointValue(input, 'start', { x: 0.5, y: 0.8 }),
    end: pointValue(input, 'end', { x: 0.5, y: 0.2 }),
    durationMs: numberInputValue(input, 'durationMs', 300)
  }),
  summary: input => {
    const start = pointValue(input, 'start', { x: 0.5, y: 0.8 })
    const end = pointValue(input, 'end', { x: 0.5, y: 0.2 })
    return `${start.x},${start.y} → ${end.x},${end.y}`
  },
  renderEditor: ({ input, patchInput }) => {
    const start = pointValue(input, 'start', { x: 0.5, y: 0.8 })
    const end = pointValue(input, 'end', { x: 0.5, y: 0.2 })
    return (
      <div className='grid gap-4'>
        <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3'>
          <NumberField
            label='Start X'
            value={start.x}
            onChange={x => patchInput({ start: { ...start, x } })}
          />
          <NumberField
            label='Start Y'
            value={start.y}
            onChange={y => patchInput({ start: { ...start, y } })}
          />
        </div>
        <div className='grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3'>
          <NumberField
            label='End X'
            value={end.x}
            onChange={x => patchInput({ end: { ...end, x } })}
          />
          <NumberField
            label='End Y'
            value={end.y}
            onChange={y => patchInput({ end: { ...end, y } })}
          />
        </div>
        <NumberField
          label='Duration'
          value={numberInputValue(input, 'durationMs', 300)}
          suffix='ms'
          onChange={durationMs => patchInput({ durationMs })}
        />
      </div>
    )
  }
}
