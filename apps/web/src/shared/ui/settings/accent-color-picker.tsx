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
      <p className='text-sm text-muted-foreground'>
        Primary actions, highlights, and navigation accents use this color.
      </p>
    </div>
    <div
      role='radiogroup'
      aria-label='Accent color'
      className='grid grid-cols-2 gap-2 sm:grid-cols-4'
    >
      {accentColorPresets.map(preset => {
        const selected = value === preset.id

        return (
          <button
            key={preset.id}
            type='button'
            role='radio'
            aria-checked={selected}
            className={cn(
              'flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-[background-color,border-color,box-shadow,color]',
              selected
                ? 'border-primary/70 bg-primary/10 text-foreground ring-1 ring-primary/35'
                : 'border-control-border bg-control text-foreground-muted hover:border-control-border-strong/55 hover:bg-control-hover hover:text-foreground'
            )}
            onClick={() => onChange(preset.id)}
          >
            <span
              className='flex size-5 shrink-0 items-center justify-center rounded-full border border-black/10 shadow-sm'
              style={{ backgroundColor: `hsl(${preset.swatch})` }}
            >
              {selected ? <IconCheck className='size-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]' /> : null}
            </span>
            <span className='truncate'>{preset.label}</span>
          </button>
        )
      })}
    </div>
  </section>
)
