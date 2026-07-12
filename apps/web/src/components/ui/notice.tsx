import type { ReactNode } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconProgressAlert } from '@tabler/icons-react'
import { Surface } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const noticeIcon = (tone: NoticeTone) => {
  if (tone === 'success') return <IconCircleCheck className='size-5' />
  if (tone === 'warning') return <IconProgressAlert className='size-5' />
  if (tone === 'danger') return <IconAlertTriangle className='size-5' />
  return <IconInfoCircle className='size-5' />
}

export const Notice = ({
  actions,
  children,
  className,
  description,
  icon,
  live = 'polite',
  title,
  tone = 'info'
}: {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  live?: 'off' | 'polite' | 'assertive'
  title?: ReactNode
  tone?: NoticeTone
}) => (
  <Surface
    level='band'
    tone={tone}
    role={tone === 'danger' ? 'alert' : 'status'}
    aria-live={live === 'off' ? undefined : live}
    className={cn('flex w-full items-start gap-3 px-4 py-3 text-sm', className)}
  >
    <span
      aria-hidden='true'
      className='mt-0.5 shrink-0'
    >
      {icon ?? noticeIcon(tone)}
    </span>
    <div className='grid min-w-0 flex-1 gap-1'>
      {title ? <div className='font-medium text-foreground'>{title}</div> : null}
      {description ? <div className='text-foreground-muted'>{description}</div> : null}
      {children}
    </div>
    {actions ? <div className='flex shrink-0 flex-wrap items-center gap-2'>{actions}</div> : null}
  </Surface>
)
