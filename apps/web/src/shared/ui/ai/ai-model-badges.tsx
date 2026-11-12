import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { aiModelRoleLabel } from '@/shared/model/ai-model-catalog'
import type { AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

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
    <Badge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
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
