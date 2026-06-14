import { IconChevronDown } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { aiModelDisplayName, aiModelSubtitle } from '@/shared/automation/automation-ai-catalog'
import { AiHealthIcon } from './ai-health-indicator'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

export const AiModelChip = ({
  provider,
  model,
  health,
  isCheckingHealth = false,
  subtitle,
  compact = false,
  disabled,
  className
}: {
  provider?: AutomationAiModelCatalogProvider
  model?: AutomationAiModelCatalogProvider['models'][number]
  health?: AutomationAiProviderHealth | null
  isCheckingHealth?: boolean
  subtitle?: string
  compact?: boolean
  disabled?: boolean
  className?: string
}) => {
  if (compact) {
    return (
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={disabled}
        className={cn('h-8 min-w-0 max-w-full justify-start gap-2 px-2.5', className)}
      >
        <GradientSparklesIcon className='size-3.5 shrink-0' />
        <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(model)}</span>
        {health !== undefined || isCheckingHealth ? (
          <AiHealthIcon
            health={health ?? null}
            isChecking={isCheckingHealth}
            className='size-3.5'
          />
        ) : null}
        <IconChevronDown className='size-3.5 shrink-0 opacity-60' />
      </Button>
    )
  }

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      disabled={disabled}
      className={cn('h-9 min-w-0 max-w-full justify-start gap-2 px-3', className)}
    >
      <GradientSparklesIcon className='size-4 shrink-0' />
      <span className='grid min-w-0 text-left leading-none'>
        <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(model)}</span>
        <span className='mt-0.5 min-w-0 truncate text-[11px] font-normal text-foreground-muted'>
          {subtitle ?? aiModelSubtitle(provider, model)}
        </span>
      </span>
      {health !== undefined || isCheckingHealth ? (
        <AiHealthIcon
          health={health ?? null}
          isChecking={isCheckingHealth}
          className='ml-1 size-3.5'
        />
      ) : null}
      <IconChevronDown className='ml-auto size-3.5 shrink-0 opacity-60' />
    </Button>
  )
}
