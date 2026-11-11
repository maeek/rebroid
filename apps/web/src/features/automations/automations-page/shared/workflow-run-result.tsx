'use client'

import { Badge } from '@/components/ui/badge'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { AutomationLastStatus } from '@/shared/contracts/automation'

const statusVariant = (status: AutomationLastStatus) => {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

const statusLabel = (status: AutomationLastStatus) => {
  if (status === 'never_run') return 'Never run'
  if (status === 'success') return 'Success'
  if (status === 'running') return 'Running'
  return 'Failed'
}

export const WorkflowRunResult = ({
  status,
  at,
  error,
  workflowId,
  runId
}: {
  status: AutomationLastStatus
  at: string | null
  error: string | null
  workflowId: string
  runId?: string | null
}) => {
  return (
    <div className='grid justify-items-start gap-1'>
      {status === 'never_run' ? (
        <span className='text-foreground-muted'>Never run</span>
      ) : (
        <>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
          <DateTimeValue
            value={at}
            compact
          />
        </>
      )}
      {status === 'failed' && (runId || error) ? (
        <ResourceLink
          href={workflowTraceHref(workflowId, runId)}
          className='text-sm'
        >
          {runId ? 'View failure' : 'Open run history'}
        </ResourceLink>
      ) : null}
    </div>
  )
}
