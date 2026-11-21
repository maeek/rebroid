import type { ComponentProps } from 'react'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { aiModelDisplayName, aiProviderKindLabel } from '@/shared/model/ai-model-catalog'
import { AiHealthIcon, aiHealthLabel } from './ai-health-indicator'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

type CatalogModel = AutomationAiModelCatalogProvider['models'][number]

export const AiModelPickerReadonlyChip = ({
  health,
  isCheckingHealth,
  selectedModel,
  selectedProvider
}: {
  health?: AutomationAiProviderHealth | null
  isCheckingHealth?: boolean
  selectedModel?: CatalogModel
  selectedProvider?: AutomationAiModelCatalogProvider
}) => (
  <div
    className={cn(
      'inline-flex h-8 min-w-0 max-w-full items-center justify-start gap-2 rounded-control px-2.5 text-sm font-medium',
      controlSurfaceClassName
    )}
  >
    <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(selectedModel)}</span>
    {selectedProvider ? (
      <span className='shrink-0 text-xs text-foreground-muted'>{aiProviderKindLabel(selectedProvider.kind)}</span>
    ) : null}
    {(health && health.status !== 'ok') || isCheckingHealth ? (
      <AiHealthIcon
        health={health ?? null}
        isChecking={Boolean(isCheckingHealth)}
        className='size-3.5'
      />
    ) : null}
  </div>
)

export const AiModelPickerTrigger = ({
  health,
  isCheckingHealth,
  selectedModel,
  className,
  ...props
}: {
  health?: AutomationAiProviderHealth | null
  isCheckingHealth?: boolean
  selectedModel?: CatalogModel
} & ComponentProps<'button'>) => (
  <button
    type='button'
    aria-label={`Agent settings: ${aiModelDisplayName(selectedModel)}`}
    title={aiModelDisplayName(selectedModel)}
    {...props}
    className={cn(
      'inline-flex h-8 min-w-0 max-w-full cursor-pointer items-center justify-start gap-1.5 rounded-full px-2.5 text-sm text-foreground-muted hover:bg-control-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
      focusRingClassName,
      className
    )}
  >
    <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(selectedModel)}</span>
    {(health && health.status !== 'ok') || isCheckingHealth ? (
      <AiHealthIcon
        health={health ?? null}
        isChecking={Boolean(isCheckingHealth)}
        className='size-3.5'
      />
    ) : null}
    <IconChevronDown className='size-3.5 shrink-0 opacity-60' />
  </button>
)

export const AiModelPickerHealthFooter = ({
  health,
  isCheckingHealth,
  label = 'Connection',
  onRecheckHealth,
  selectedModel
}: {
  health?: AutomationAiProviderHealth | null
  isCheckingHealth?: boolean
  label?: string
  onRecheckHealth?: () => void
  selectedModel?: CatalogModel
}) => {
  if (!onRecheckHealth) return null

  return (
    <div
      className='flex min-w-0 items-center gap-2 px-2 text-xs text-foreground-muted'
      role='status'
    >
      <AiHealthIcon
        health={health ?? null}
        isChecking={Boolean(isCheckingHealth)}
        className='size-3.5 shrink-0'
      />
      <span
        className='min-w-0 flex-1 break-words'
        title={health?.message}
      >
        {health?.status === 'error' && !isCheckingHealth
          ? health.message
          : `${label}: ${aiHealthLabel(health ?? null, Boolean(isCheckingHealth))}`}
      </span>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        disabled={!selectedModel || isCheckingHealth}
        aria-label='Re-check model health'
        onClick={onRecheckHealth}
      >
        <IconRefresh className='size-3.5' />
      </Button>
    </div>
  )
}
