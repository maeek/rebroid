import { actionInputBinding } from '@rebroid/automation-core/command-registry'
import { Button } from '@/components/ui/button'
import { NumberField } from './action-fields'

export function DurationField({
  input,
  field = 'durationMs',
  label,
  fallback,
  min,
  max = 120000,
  presets,
  patchInput
}: {
  input: Record<string, unknown>
  field?: string
  label: string
  fallback: number
  min: number
  max?: number
  presets?: number[]
  patchInput: (patch: Record<string, unknown>) => void
}) {
  const raw = input[field]
  const ms = typeof raw === 'number' ? raw : fallback
  const linked = actionInputBinding(raw)
  return (
    <div className='grid gap-2'>
      <NumberField
        field={field}
        label={label}
        suffix='s'
        min={min / 1000}
        max={max / 1000}
        step={0.001}
        value={ms / 1000}
        onChange={seconds => patchInput({ [field]: Math.round(seconds * 1000) })}
      />
      {presets && !linked ? (
        <div
          role='group'
          aria-label={`${label} presets`}
          className='flex flex-wrap gap-1.5'
        >
          {presets.map(seconds => (
            <Button
              key={seconds}
              type='button'
              size='sm'
              variant={ms === seconds * 1000 ? 'secondary' : 'ghost'}
              aria-pressed={ms === seconds * 1000}
              onClick={() => patchInput({ [field]: seconds * 1000 })}
            >
              {seconds} s
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
