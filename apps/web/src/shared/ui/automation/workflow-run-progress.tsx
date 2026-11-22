import { IconLoader2 } from '@tabler/icons-react'
import { StateTransition } from '@/components/ui/state-transition'
import { isActiveRunStatus } from '@/shared/model/automation-run-status'
import { workflowRunStepLabel } from '@/shared/model/workflow-action-presentation'
import type { AutomationRunEvent, AutomationRunStatus } from '@/shared/contracts/automation'

const preparationLabels = {
  'checking-target': 'Checking app and profile…',
  'starting-app': 'Starting app…',
  'waiting-for-android': 'Waiting for Android…'
} as const

const progressLabel = (status: AutomationRunStatus, events: AutomationRunEvent[]) => {
  if (status === 'queued') {
    const phase = events.findLast(event => event.type === 'run.preparing')?.data.phase
    if (phase === 'checking-target' || phase === 'starting-app' || phase === 'waiting-for-android') {
      return preparationLabels[phase]
    }
    return 'Waiting in queue…'
  }

  const step = events.findLast(
    event => event.type === 'step.started' || event.type === 'step.completed' || event.type === 'step.failed'
  )
  if (step?.type === 'step.started' && typeof step.data.uses === 'string') {
    return `Running step · ${workflowRunStepLabel(step.data.uses)}`
  }
  return 'Running workflow…'
}

export const WorkflowRunProgress = ({
  runId,
  status,
  events,
  stopping,
  streamError
}: {
  runId: string
  status: AutomationRunStatus
  events: AutomationRunEvent[]
  stopping: boolean
  streamError: string | null
}) => {
  if (!isActiveRunStatus(status)) return null
  const label = stopping ? 'Stopping workflow…' : progressLabel(status, events)
  return (
    <div
      role='status'
      className='grid min-h-6 gap-1 text-sm'
    >
      <StateTransition
        state={label}
        identity={runId}
      >
        <IconLoader2
          aria-hidden
          className='size-4 shrink-0 text-primary motion-safe:animate-spin'
        />
        <span className='font-medium'>{label}</span>
      </StateTransition>
      {streamError ? <span className='text-xs text-foreground-muted'>{streamError}</span> : null}
    </div>
  )
}
