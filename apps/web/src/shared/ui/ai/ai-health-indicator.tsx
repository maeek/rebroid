import type { ReactNode } from 'react'
import { IconCircleCheck, IconCircleDashed, IconCircleX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

export const aiHealthLabel = (health: AutomationAiProviderHealth | null, isChecking: boolean) => {
  if (isChecking) return 'Checking'
  if (!health) return 'Unknown'
  if (health.status === 'ok') return 'Online'
  if (health.status === 'disabled') return 'Disabled'
  return 'Error'
}

export const aiHealthBadgeVariant = (health: AutomationAiProviderHealth | null) => {
  if (health?.status === 'ok') return 'status'
  if (health?.status === 'disabled') return 'secondary'
  if (health) return 'destructive'
  return 'outline'
}

export const AiHealthIcon = ({
  health,
  isChecking,
  className
}: {
  health: AutomationAiProviderHealth | null
  isChecking: boolean
  className?: string
}) => {
  if (isChecking) {
    return <IconCircleDashed className={cn('size-4 animate-spin text-foreground-muted', className)} />
  }

  if (!health) {
    return <IconCircleDashed className={cn('size-4 text-foreground-muted', className)} />
  }

  if (health.status === 'ok') {
    return <IconCircleCheck className={cn('size-4 text-success', className)} />
  }

  return <IconCircleX className={cn('size-4 text-destructive', className)} />
}

export const AiHealthBadge = ({
  health,
  isChecking,
  className
}: {
  health: AutomationAiProviderHealth | null
  isChecking: boolean
  className?: string
}) => (
  <Badge
    variant={aiHealthBadgeVariant(health)}
    className={cn('capitalize', className)}
    title={health?.message}
  >
    {aiHealthLabel(health, isChecking)}
  </Badge>
)

export const AiHealthIndicator = ({
  health,
  isChecking,
  label = 'Provider health',
  emptyMessage = 'Health has not been checked yet.',
  onRecheck,
  action,
  className
}: {
  health: AutomationAiProviderHealth | null
  isChecking: boolean
  label?: string
  emptyMessage?: string
  onRecheck?: () => void
  action?: ReactNode
  className?: string
}) => {
  const message = isChecking ? 'Checking selected provider/model...' : health?.message || emptyMessage

  return (
    <div className={cn('rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 text-xs', className)}>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2 font-medium text-foreground'>
          <AiHealthIcon
            health={health}
            isChecking={isChecking}
          />
          <span className='truncate'>{label}</span>
        </div>
        {action ?? null}
        {!action && onRecheck ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-7 px-2'
            disabled={isChecking}
            onClick={onRecheck}
          >
            Recheck
          </Button>
        ) : null}
      </div>
      <div className='mt-1 break-words text-foreground-muted'>{message}</div>
    </div>
  )
}
