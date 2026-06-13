import { IconCheck, IconDatabase } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export const ProfileTile = ({
  name,
  disabled,
  selected,
  isActive,
  onChange,
  icon,
  className,
  description
}: {
  name: string
  disabled?: boolean
  selected?: boolean
  isActive?: boolean
  onChange?: () => void
  icon?: React.ReactNode
  className?: string
  description?: string
}) => {
  return (
    <button
      key={name}
      type='button'
      disabled={disabled}
      className={cn(
        'flex min-h-10 items-center gap-3 rounded-lg border p-2 text-left transition-all duration-150',
        'bg-surface-panel/45 hover:border-primary/55 hover:bg-surface-panel/64 dark:shadow-[inset_0_0_10px_0_rgba(255,255,255,0.025)] shadow-[inset_0_0_10px_0_rgba(0,0,0,0.025)]',
        selected
          ? 'border-primary/80 ring-1 ring-primary/30 shadow-[inset_0_0_10px_0_color-mix(in_srgb,var(--primary)_30%,rgba(0,0,0,0))]! dark:shadow-[inset_0_0_10px_0_color-mix(in_srgb,var(--primary)_10%,rgba(0,0,0,0))]!'
          : 'border-border/70',
        className
      )}
      onClick={onChange}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground relative',
          selected && 'bg-primary/18 text-primary'
        )}
      >
        {selected ? <IconCheck className='size-4' /> : icon || <IconDatabase className='size-4' />}
        <Visible when={isActive}>
          <div className='absolute top-0 right-0 rounded-2xl size-2 bg-primary/95 z-10' />
          <div className='absolute top-0 right-0 rounded-2xl size-2 bg-primary z-10 animate-ping duration-[2s]' />
        </Visible>
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold'>
          {name}
          <Visible when={isActive}>
            <span className='text-primary ml-1 font-normal'>(Running)</span>
          </Visible>
        </span>
        <span className='block truncate text-xs text-muted-foreground'>{description}</span>
      </span>
    </button>
  )
}
