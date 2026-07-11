'use client'

import { IconCheck } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { accentColorPresets, type AccentColor } from '@/shared/model/theme/accent-color'

export const AccentColorPicker = ({
  className,
  value,
  onChange
}: {
  className?: string
  value: AccentColor
  onChange: (accentColor: AccentColor) => void
}) => (
  <section className={cn('grid gap-3', className)}>
    <div>
      <h3 className='text-sm font-medium'>Accent color</h3>
      <p className='text-sm text-foreground-muted'>
        Primary actions, highlights, and navigation accents use this color.
      </p>
    </div>
    <div
      role='radiogroup'
      aria-label='Accent color'
      className='flex flex-wrap gap-2'
    >
      {accentColorPresets.map(preset => {
        const selected = value === preset.id

        return (
          <button
            key={preset.id}
            type='button'
            role='radio'
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
  </section>
)
