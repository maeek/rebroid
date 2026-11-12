import type { ReactNode } from 'react'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { serviceHealthState, type DisplayServiceHealth } from '@/shared/model/diagnostics/service-health'

export const ServiceHealthNotice = ({
  health,
  loading = false,
  title,
  description,
  actions,
  requestId
}: {
  health?: DisplayServiceHealth
  loading?: boolean
  title?: string
  description?: string
  actions?: ReactNode
  requestId?: string
}) => {
  const state = serviceHealthState(health)

  return (
    <Notice
      loading={loading}
      tone={state.tone === 'neutral' ? 'info' : state.tone}
      title={loading ? <Skeleton className='h-5 w-20' /> : (title ?? state.label)}
      description={loading ? <Skeleton className='h-5 w-full max-w-96' /> : (description ?? state.description)}
      actions={loading ? undefined : actions}
    >
      {!loading && requestId ? <p className='text-xs text-foreground-muted'>Reference: {requestId}</p> : null}
    </Notice>
  )
}
