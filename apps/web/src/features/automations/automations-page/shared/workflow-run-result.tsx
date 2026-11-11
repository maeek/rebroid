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

type WorkflowRunResultProps = {
  status: AutomationLastStatus
  at: string | null
  error: string | null
  workflowId: string
  runId?: string | null
}

export const WorkflowRunStatus = ({ status }: { status: AutomationLastStatus }) =>
  status === 'never_run' ? (
    <span className='text-foreground-muted'>Never run</span>
  ) : (
    <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
  )

export const WorkflowRunDetailsLink = ({ status, error, workflowId, runId }: Omit<WorkflowRunResultProps, 'at'>) => {
  if (status !== 'failed' || (!runId && !error)) return null

  return (
    <ResourceLink
      href={workflowTraceHref(workflowId, runId)}
      className='text-sm'
    >
      {runId ? 'View failure' : 'Open run history'}
    </ResourceLink>
  )
}

export const WorkflowRunResult = ({ at, ...run }: WorkflowRunResultProps) => (
  <div className='grid justify-items-start gap-1'>
    <WorkflowRunStatus status={run.status} />
    {run.status !== 'never_run' ? (
      <DateTimeValue
        value={at}
        compact
      />
    ) : null}
    <WorkflowRunDetailsLink {...run} />
  </div>
)
