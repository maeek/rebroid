import { IconCircleCheck, IconCircleDashed, IconCircleX } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

export const aiHealthLabel = (health: AutomationAiProviderHealth | null, isChecking: boolean) => {
  if (isChecking) return 'Checking'
  if (!health) return 'Unknown'
  if (health.status === 'ok') return 'Online'
  if (health.status === 'disabled') return 'Disabled'
  return 'Error'
}

export const aiHealthBadgeVariant = (health: AutomationAiProviderHealth | null) => {
  if (health?.status === 'ok') return 'success'
  if (health?.status === 'disabled') return 'neutral'
  if (health) return 'danger'
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

  return <IconCircleX className={cn('size-4 text-danger', className)} />
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
