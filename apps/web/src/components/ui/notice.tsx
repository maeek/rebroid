import type { ReactNode } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconProgressAlert } from '@tabler/icons-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Surface } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const noticeIcon = (tone: NoticeTone) => {
  if (tone === 'success') return <IconCircleCheck className='size-5' />
  if (tone === 'warning') return <IconProgressAlert className='size-5' />
  if (tone === 'danger') return <IconAlertTriangle className='size-5' />
  return <IconInfoCircle className='size-5' />
}

const noticeRole = (tone: NoticeTone) => (tone === 'danger' ? 'alert' : 'status')

export const Notice = ({
  actions,
  children,
  className,
  description,
  icon,
  live = 'polite',
  loading = false,
  title,
  tone = 'info'
}: {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  live?: 'off' | 'polite' | 'assertive'
  loading?: boolean
  title?: ReactNode
  tone?: NoticeTone
}) => (
  <Surface
    level='band'
    tone={loading ? 'neutral' : tone}
    role={loading ? undefined : noticeRole(tone)}
    aria-busy={loading || undefined}
    aria-live={loading || live === 'off' ? undefined : live}
    className={cn('flex w-full items-start gap-3 px-4 py-3 text-sm max-sm:flex-wrap', className)}
  >
    <span
      aria-hidden='true'
      className='mt-0.5 shrink-0'
    >
      {loading ? (
        <Skeleton
          as='span'
          className='block size-5'
        />
      ) : (
        (icon ?? noticeIcon(tone))
      )}
    </span>
    <div className='grid min-w-0 flex-1 gap-1'>
      {title ? <div className='font-medium text-foreground'>{title}</div> : null}
      {description ? <div className='text-foreground-muted'>{description}</div> : null}
      {children}
    </div>
    {actions ? (
      <div className='flex shrink-0 flex-wrap items-center gap-2 max-sm:ml-8 max-sm:w-full'>{actions}</div>
    ) : null}
  </Surface>
)
