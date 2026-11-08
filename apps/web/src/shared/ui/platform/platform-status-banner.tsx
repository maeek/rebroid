import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { editorSectionClassName, Surface } from '@/components/ui/surface'

const statusTone = (status: string, ok: boolean) => {
  if (status === 'offline') {
    return {
      surface: 'danger' as const,
      badge: 'danger' as const
    }
  }

  if (ok || status === 'healthy') {
    return {
      surface: 'success' as const,
      badge: 'success' as const
    }
  }

  return {
    surface: 'warning' as const,
    badge: 'warning' as const
  }
}

export const PlatformStatusBanner = ({
  status,
  ok,
  message,
  actions,
  details,
  detailTitle = 'Details',
  loading = false
}: {
  status: string
  ok: boolean
  message: ReactNode
  actions?: ReactNode
  details?: ReactNode
  detailTitle?: string
  loading?: boolean
}) => {
  const tone = statusTone(status, ok)

  return (
    <div className='grid w-full gap-3'>
      <Surface
        level='band'
        tone={loading ? 'neutral' : tone.surface}
        role={loading ? undefined : 'status'}
        aria-label={loading ? 'Loading service health' : undefined}
        aria-busy={loading || undefined}
        aria-live={loading ? 'off' : 'polite'}
        className='w-full rounded-panel px-4 py-2'
      >
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div className='flex min-w-0 flex-wrap items-center gap-3'>
            <Badge
              className='w-fit justify-self-start capitalize'
              variant={loading ? 'neutral' : tone.badge}
            >
              {loading ? <Skeleton className='h-4 w-12' /> : status}
            </Badge>
            {loading ? (
              <Skeleton className='h-6 w-56 max-w-full' />
            ) : (
              <span className='min-w-0 text-sm leading-6 text-foreground'>{message}</span>
            )}
          </div>
          {actions}
        </div>
      </Surface>
      {details ? (
        <Section
          surface='plain'
          title={detailTitle}
          className={editorSectionClassName}
          headingSpacing='compact'
        >
          {details}
        </Section>
      ) : null}
    </div>
  )
}
