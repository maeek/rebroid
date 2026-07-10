import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AutomationRunStatus } from '@/server/orchestrator/automations/types'

export type AutomationRunDisplayStatus = AutomationRunStatus | 'canceling'

const statusPresentation: Record<
  AutomationRunDisplayStatus,
  { label: string; className: string; dotClassName: string }
> = {
  queued: {
    label: 'Queued',
    className: 'border-border/70 bg-surface-band/60 text-foreground-muted',
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
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    dotClassName: 'bg-destructive'
  },
  canceled: {
    label: 'Canceled',
    className: 'border-border/70 bg-surface-band/60 text-foreground-muted',
    dotClassName: 'bg-foreground-muted'
  },
  canceling: {
    label: 'Stopping',
    className: 'border-warning/30 bg-warning/10 text-warning',
    dotClassName: 'animate-pulse bg-warning'
  }
}

export const AutomationRunStatusBadge = ({
  status,
  className
}: {
  status: AutomationRunDisplayStatus
  className?: string
}) => {
  const presentation = statusPresentation[status]

  return (
    <Badge
      variant='outline'
      className={cn('gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium', presentation.className, className)}
    >
      <span className={cn('size-1.5 rounded-full', presentation.dotClassName)} />
      {presentation.label}
    </Badge>
  )
}
