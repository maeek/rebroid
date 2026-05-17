import { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

const variants = {
  vertical: 'flex-col items-start w-full',
  horizontal: 'flex-row items-start justify-between w-full'
} as const

export const Setting = ({
  label,
  description,
  children,
  variant = 'horizontal',
  className,
  withLabel,
  contentClassName
}: {
  label: string
  description?: ReactNode
  children: ReactNode
  className?: string
  variant?: keyof typeof variants
  withLabel?: boolean
  contentClassName?: string
}) => {
  const content = (
    <div className={cn('flex gap-4', variants[variant], className)}>
      <div
        className={cn('flex min-w-0 flex-col gap-1', {
          'w-full': variant === 'vertical',
          'flex-1': variant !== 'vertical'
        })}
      >
        <div className='font-bold text-sm text-foreground'>{label}</div>
        <Visible when={description}>
          <div className='text-xs leading-relaxed text-muted-foreground'>{description}</div>
        </Visible>
      </div>
      <div
        className={cn(
          'font-normal text-sm',
          {
            'flex w-full flex-col items-start': variant === 'vertical',
            'flex shrink-0 items-center justify-end': variant !== 'vertical'
          },
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  )

  return withLabel ? <label>{content}</label> : content
}
