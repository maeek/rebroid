import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { aiModelRoleLabel, aiProviderKindLabel } from '@/shared/automation/automation-ai-catalog'
import type { AutomationAiProvider, AutomationAiProviderModel } from '@/server/orchestrator/settings/types'

export const AiProviderKindBadge = ({
  kind,
  className
}: {
  kind: AutomationAiProvider['kind']
  className?: string
}) => (
  <Badge
    variant='secondary'
    className={className}
  >
    {aiProviderKindLabel(kind)}
  </Badge>
)

export const AiModelRoleBadges = ({
  roles,
  className
}: {
  roles?: AutomationAiProviderModel['roles']
  className?: string
}) => {
  const visibleRoles = roles ?? []

  if (visibleRoles.length === 0) {
    return <Badge variant='secondary'>No role</Badge>
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visibleRoles.map(role => (
        <Badge
          key={role}
          variant='outline'
          className='capitalize'
        >
          {aiModelRoleLabel(role)}
        </Badge>
      ))}
    </div>
  )
}

export const AiModelStateBadges = ({
  enabled,
  defaultFor,
  className
}: {
  enabled: boolean
  defaultFor?: AutomationAiProviderModel['defaultFor']
  className?: string
}) => (
  <div className={cn('flex flex-wrap items-center gap-1', className)}>
    <Badge variant={enabled ? 'status' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
    {(defaultFor ?? []).map(role => (
      <Badge
        key={role}
        variant='outline'
      >
        {aiModelRoleLabel(role)} default
      </Badge>
    ))}
  </div>
)
