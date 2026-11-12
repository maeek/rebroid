import type { ReactNode } from 'react'
import { Notice } from '@/components/ui/notice'
import { serviceHealthState, type DisplayServiceHealth } from '@/shared/model/diagnostics/service-health'

export const ServiceHealthNotice = ({
  health,
  title,
  description,
  actions,
  requestId
}: {
  health?: DisplayServiceHealth
  title?: string
  description?: string
  actions?: ReactNode
  requestId?: string
}) => {
  const state = serviceHealthState(health)

  return (
    <Notice
      tone={state.tone === 'neutral' ? 'info' : state.tone}
      title={title ?? state.label}
      description={description ?? state.description}
      actions={actions}
    >
      {requestId ? <p className='text-xs text-foreground-muted'>Reference: {requestId}</p> : null}
    </Notice>
  )
}
