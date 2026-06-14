import type { ReactNode } from 'react'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'
import {
  aiModelDisplayName,
  aiProviderKindLabel,
  nextCatalogProviderAndModel
} from '@/shared/automation/automation-ai-catalog'
import { AiHealthIcon, AiHealthIndicator } from './ai-health-indicator'
import { AiProviderKindBadge } from './ai-model-badges'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/server/orchestrator/settings/types'

type CatalogModel = AutomationAiModelCatalogProvider['models'][number]

const ModelSelectItem = ({ model }: { model: CatalogModel }) => (
  <SelectItem
    value={model.id}
    label={model.label || model.id}
  >
    <span className='min-w-0 truncate'>{model.label || model.id}</span>
    {model.default ? <span className='ml-2 text-xs text-foreground-muted'>Default</span> : null}
  </SelectItem>
)

export const AiModelPicker = ({
  catalog,
  selectedProvider,
  selectedModel,
  selectedVisionProvider,
  selectedVisionModel,
  visionCatalog = [],
  health,
  isCheckingHealth = false,
  defaultOpen,
  trigger,
  advanced,
  onProviderChange,
  onModelChange,
  onVisionProviderChange,
  onVisionModelChange,
  onRecheckHealth
}: {
  catalog: AutomationAiModelCatalogProvider[]
  selectedProvider?: AutomationAiModelCatalogProvider
  selectedModel?: CatalogModel
  selectedVisionProvider?: AutomationAiModelCatalogProvider
  selectedVisionModel?: CatalogModel
  visionCatalog?: AutomationAiModelCatalogProvider[]
  health?: AutomationAiProviderHealth | null
  isCheckingHealth?: boolean
  defaultOpen?: boolean
  trigger?: ReactNode
  advanced?: ReactNode
  onProviderChange: (providerId: string) => void
  onModelChange: (modelId: string) => void
  onVisionProviderChange?: (providerId: string) => void
  onVisionModelChange?: (modelId: string) => void
  onRecheckHealth?: () => void
}) => {
  const hasVisionPicker = Boolean(onVisionProviderChange && onVisionModelChange)
  const showProviderSelect = catalog.length > 1
  const showVisionProviderSelect = visionCatalog.length > 1
  const showReadOnlyPlannerChip =
    !trigger && !hasVisionPicker && catalog.length === 1 && (selectedProvider?.models.length ?? 0) <= 1

  if (showReadOnlyPlannerChip) {
    return (
      <div
        className={cn(
          'inline-flex h-8 min-w-0 max-w-full items-center justify-start gap-2 rounded-md px-2.5 text-sm font-medium',
          controlSurfaceClassName
        )}
      >
        <GradientSparklesIcon className='size-3.5 shrink-0' />
        <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(selectedModel)}</span>
        {selectedProvider ? (
          <span className='shrink-0 text-xs text-foreground-muted'>{aiProviderKindLabel(selectedProvider.kind)}</span>
        ) : null}
        {health !== undefined || isCheckingHealth ? (
          <AiHealthIcon
            health={health ?? null}
            isChecking={isCheckingHealth}
            className='size-3.5'
          />
        ) : null}
      </div>
    )
  }

  return (
    <Popover defaultOpen={defaultOpen}>
      {trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : (
        <PopoverTrigger
          className={cn(
            'inline-flex h-8 min-w-0 max-w-full cursor-pointer items-center justify-start gap-2 rounded-md px-2.5 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
            controlSurfaceClassName,
            controlHoverClassName,
            focusRingClassName
          )}
        >
          <GradientSparklesIcon className='size-3.5 shrink-0' />
          <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(selectedModel)}</span>
          {health !== undefined || isCheckingHealth ? (
            <AiHealthIcon
              health={health ?? null}
              isChecking={isCheckingHealth}
              className='size-3.5'
            />
          ) : null}
          <IconChevronDown className='size-3.5 shrink-0 opacity-60' />
        </PopoverTrigger>
      )}
      <PopoverContent
        align='end'
        className='w-[min(calc(100vw-2rem),25rem)]'
      >
        <div className='grid gap-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='grid min-w-0 gap-1'>
              <div className='text-sm font-medium'>AI model</div>
              <div className='min-w-0 truncate text-xs text-foreground-muted'>
                {selectedProvider
                  ? `${selectedProvider.label} · ${aiProviderKindLabel(selectedProvider.kind)}`
                  : 'No provider'}
              </div>
            </div>
            {selectedProvider ? <AiProviderKindBadge kind={selectedProvider.kind} /> : null}
          </div>

          <div className='grid gap-3'>
            {showProviderSelect ? (
              <div className='grid gap-2'>
                <Label>Provider</Label>
                <Select
                  value={selectedProvider?.id ?? ''}
                  disabled={catalog.length === 0}
                  onValueChange={nextProviderId => {
                    const nextSelection = nextCatalogProviderAndModel(catalog, nextProviderId)
                    onProviderChange(nextProviderId)
                    onModelChange(nextSelection.model?.id ?? '')
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select provider' />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map(provider => (
                      <SelectItem
                        key={provider.id}
                        value={provider.id}
                        label={provider.label}
                      >
                        <span>{provider.label}</span>
                        <span className='ml-2 text-xs text-foreground-muted'>{aiProviderKindLabel(provider.kind)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className='grid gap-2'>
              <Label>Model</Label>
              <Select
                value={selectedModel?.id ?? ''}
                disabled={!selectedProvider || selectedProvider.models.length === 0}
                onValueChange={onModelChange}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select model' />
                </SelectTrigger>
                <SelectContent>
                  {(selectedProvider?.models ?? []).map(model => (
                    <ModelSelectItem
                      key={model.id}
                      model={model}
                    />
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasVisionPicker ? (
              <>
                {showVisionProviderSelect ? (
                  <div className='grid gap-2'>
                    <Label>Vision provider</Label>
                    <Select
                      value={selectedVisionProvider?.id ?? ''}
                      disabled={visionCatalog.length === 0}
                      onValueChange={nextProviderId => {
                        const nextSelection = nextCatalogProviderAndModel(visionCatalog, nextProviderId)
                        onVisionProviderChange?.(nextProviderId)
                        onVisionModelChange?.(nextSelection.model?.id ?? '')
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Optional vision provider' />
                      </SelectTrigger>
                      <SelectContent>
                        {visionCatalog.map(provider => (
                          <SelectItem
                            key={provider.id}
                            value={provider.id}
                            label={provider.label}
                          >
                            <span>{provider.label}</span>
                            <span className='ml-2 text-xs text-foreground-muted'>
                              {aiProviderKindLabel(provider.kind)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className='grid gap-2'>
                  <Label>Vision model</Label>
                  <Select
                    value={selectedVisionModel?.id ?? ''}
                    disabled={!selectedVisionProvider || selectedVisionProvider.models.length === 0}
                    onValueChange={nextModelId => onVisionModelChange?.(nextModelId)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Optional vision model' />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedVisionProvider?.models ?? []).map(model => (
                        <ModelSelectItem
                          key={model.id}
                          model={model}
                        />
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {advanced ? <div className='grid gap-2'>{advanced}</div> : null}
          </div>

          {onRecheckHealth ? (
            <AiHealthIndicator
              health={health ?? null}
              isChecking={isCheckingHealth}
              label='Planner health'
              action={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  disabled={!selectedModel || isCheckingHealth}
                  aria-label='Re-check planner health'
                  onClick={onRecheckHealth}
                >
                  <IconRefresh className={isCheckingHealth ? 'size-4 animate-spin' : 'size-4'} />
                </Button>
              }
            />
          ) : null}

          {catalog.length === 0 ? (
            <div className='rounded-md border border-border/70 bg-surface-band/35 px-3 py-2 text-xs text-foreground-muted'>
              No enabled AI provider or model is configured.
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
