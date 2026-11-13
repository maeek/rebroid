import { IconCheck } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { StateTransition } from '@/components/ui/state-transition'
import { cn } from '@/lib/utils'
import type { AutomationRunStatus } from '@/shared/contracts/automation'

export type AutomationRunDisplayStatus = AutomationRunStatus | 'canceling'

const statusPresentation: Record<
  AutomationRunDisplayStatus,
  { label: string; className: string; dotClassName: string }
> = {
  queued: {
    label: 'Queued',
    className: 'border-surface-border/70 bg-surface-band/60 text-foreground-muted',
    dotClassName: 'bg-foreground-muted'
  },
  running: {
    label: 'Running',
    className: 'border-primary/30 bg-primary/10 text-primary',
    dotClassName: 'bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]'
  },
  success: {
    label: 'Completed',
    className: 'border-success/30 bg-success/10 text-success',
    dotClassName: 'bg-success'
  },
  failed: {
    label: 'Failed',
    className: 'border-danger/30 bg-danger/10 text-danger',
    dotClassName: 'bg-danger'
  },
  canceled: {
    label: 'Canceled',
    className: 'border-surface-border/70 bg-surface-band/60 text-foreground-muted',
    dotClassName: 'bg-foreground-muted'
  },
  canceling: {
    label: 'Stopping',
    className: 'border-warning/30 bg-warning/10 text-warning',
    dotClassName: 'bg-warning'
  }
}

export const AutomationRunStatusBadge = ({
  status,
  runId,
  className
}: {
  status: AutomationRunDisplayStatus
  runId: string
  className?: string
}) => {
  const presentation = statusPresentation[status]

  return (
    <Badge
      variant='outline'
      className={cn('gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', presentation.className, className)}
    >
      <StateTransition
        state={status}
        identity={runId}
      >
        <span
          aria-hidden
          className='inline-flex size-3 items-center justify-center'
        >
          {status === 'success' ? (
            <IconCheck className='size-3' />
          ) : (
            <span className={cn('size-1.5 rounded-full', presentation.dotClassName)} />
          )}
        </span>
        {presentation.label}
      </StateTransition>
    </Badge>
  )
}
