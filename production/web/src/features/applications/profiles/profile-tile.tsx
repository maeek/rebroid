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
        'flex min-h-14 w-full items-center gap-3 rounded-lg border border-border/80 bg-secondary/35 px-3 text-left transition-[background-color,border-color,color] hover:border-primary/60 hover:bg-primary/8 disabled:cursor-not-allowed disabled:opacity-55 relative',
        {
          'border-primary/75 bg-primary/14 text-foreground': selected
        },
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
