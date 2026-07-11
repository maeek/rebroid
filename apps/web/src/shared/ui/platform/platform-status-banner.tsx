import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'

const statusTone = (status: string, ok: boolean) => {
  if (status === 'offline') {
    return {
      banner: 'border-danger/40 bg-danger/10',
      badge: 'danger' as const
    }
  }

  if (ok || status === 'healthy') {
    return {
      banner: 'border-success/35 bg-success/10',
      badge: 'success' as const
    }
  }

  return {
    banner: 'border-warning/35 bg-warning/10',
    badge: 'warning' as const
  }
}

export const PlatformStatusBanner = ({
  status,
  ok,
  message,
  actions,
  details,
  detailTitle = 'Technical details'
}: {
  status: string
  ok: boolean
  message: ReactNode
  actions?: ReactNode
  details?: ReactNode
  detailTitle?: string
}) => {
  const tone = statusTone(status, ok)

  return (
    <div
      className={cn(
        'rounded-panel border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] supports-[backdrop-filter]:backdrop-blur-md',
        tone.banner
      )}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex min-w-0 flex-wrap items-center gap-3'>
          <Badge
            className='capitalize'
            variant={tone.badge}
          >
            {status}
          </Badge>
          <span className='min-w-0 text-sm text-foreground-muted'>{message}</span>
        </div>
        {actions}
      </div>
      {details ? (
        <Section
          surface='plain'
          title={detailTitle}
          collapsible
          className='mt-3'
          titleClassName='border-t border-surface-border/60 pt-3 text-sm text-foreground-muted'
          contentClassName='gap-3'
        >
          {details}
        </Section>
      ) : null}
    </div>
  )
}
