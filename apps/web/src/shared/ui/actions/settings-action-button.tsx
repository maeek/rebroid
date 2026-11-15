import type { ComponentProps } from 'react'
import { IconSettings } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SettingsActionButtonProps = Omit<ComponentProps<typeof Button>, 'asChild' | 'children' | 'size'> & {
  label: string
  desktopIcon?: typeof IconSettings
  size?: 'sm' | 'md'
}

export function SettingsActionButton({
  label,
  desktopIcon: DesktopIcon,
  size = 'sm',
  className,
  ...props
}: SettingsActionButtonProps) {
  return (
    <Button
      type='button'
      variant='secondary'
      size={size}
      className={cn('max-sm:size-11', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <span className='sm:hidden'>
        <IconSettings aria-hidden />
      </span>
      {DesktopIcon ? (
        <DesktopIcon
          aria-hidden
          className='hidden sm:block'
        />
      ) : null}
      <span className='hidden sm:inline'>{label}</span>
    </Button>
  )
}
