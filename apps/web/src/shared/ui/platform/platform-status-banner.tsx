import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/section'
import { Surface } from '@/components/ui/surface'

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
    <Surface
      level='band'
      tone={tone.surface}
      role='status'
      aria-live='polite'
      className='w-full px-4 py-3'
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
    </Surface>
  )
}
