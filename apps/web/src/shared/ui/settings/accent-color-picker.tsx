'use client'

import { IconCheck } from '@tabler/icons-react'
import { FormField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { accentColorPresets, type AccentColor } from '@/shared/model/theme/accent-color'

export const AccentColorPicker = ({
  className,
  value,
  onChange,
  loading = false
}: {
  className?: string
  value: AccentColor
  onChange: (accentColor: AccentColor) => void
  loading?: boolean
}) => (
  <FormField
    label='Accent color'
    description='Primary actions, highlights, and navigation accents use this color.'
    layout='vertical'
    className={className}
  >
    <div
      role='radiogroup'
      aria-label='Accent color'
      className='flex flex-wrap gap-2'
    >
      {accentColorPresets.map(preset => {
        const selected = value === preset.id

        if (loading)
          return (
            <Skeleton
              key={preset.id}
              className='size-12 rounded-full'
            />
          )

        return (
          <button
            key={preset.id}
            type='button'
            role='radio'
            aria-label={preset.label}
            aria-checked={selected}
            className='flex size-12 shrink-0 items-center justify-center rounded-full border border-black/10 shadow-control'
            style={{ backgroundColor: `hsl(${preset.swatch})` }}
            onClick={() => onChange(preset.id)}
          >
            <span>
              {selected ? <IconCheck className='size-5 text-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]' /> : null}
            </span>
          </button>
        )
      })}
    </div>
  </FormField>
)
