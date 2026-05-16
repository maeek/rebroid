import { ReactNode } from 'react'
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
      <div className={cn('flex min-w-0 flex-col gap-1', variant === 'vertical' ? 'w-full' : 'flex-1')}>
        <div className='font-bold text-sm text-foreground'>{label}</div>
        {description ? <div className='text-xs leading-relaxed text-muted-foreground'>{description}</div> : null}
      </div>
      <div
        className={cn(
          'font-normal text-sm',
          variant === 'vertical' ? 'flex w-full flex-col items-start' : 'flex shrink-0 items-center justify-end',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  )

  return withLabel ? <label>{content}</label> : content
}
