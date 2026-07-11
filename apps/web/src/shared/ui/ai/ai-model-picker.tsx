import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AiModelPickerFields,
  AiModelPickerHeader,
  AiModelPickerHealthFooter,
  AiModelPickerReadonlyChip,
  AiModelPickerTrigger
} from './ai-model-picker-parts'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

type CatalogModel = AutomationAiModelCatalogProvider['models'][number]

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
  const showReadOnlyPlannerChip =
    !trigger && !hasVisionPicker && catalog.length === 1 && (selectedProvider?.models.length ?? 0) <= 1

  if (showReadOnlyPlannerChip) {
    return (
      <AiModelPickerReadonlyChip
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        health={health}
        isCheckingHealth={isCheckingHealth}
      />
    )
  }

  return (
    <Popover defaultOpen={defaultOpen}>
      {trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : (
        <PopoverTrigger asChild>
          <AiModelPickerTrigger
            selectedModel={selectedModel}
            health={health}
            isCheckingHealth={isCheckingHealth}
          />
        </PopoverTrigger>
      )}
      <PopoverContent
        align='end'
        className='w-[min(calc(100vw-2rem),25rem)]'
      >
        <div className='grid gap-4'>
          <AiModelPickerHeader selectedProvider={selectedProvider} />
          <AiModelPickerFields
            catalog={catalog}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            selectedVisionProvider={selectedVisionProvider}
            selectedVisionModel={selectedVisionModel}
            visionCatalog={visionCatalog}
            advanced={advanced}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onVisionProviderChange={onVisionProviderChange}
            onVisionModelChange={onVisionModelChange}
          />

          <AiModelPickerHealthFooter
            health={health}
            isCheckingHealth={isCheckingHealth}
            selectedModel={selectedModel}
            onRecheckHealth={onRecheckHealth}
          />

          {catalog.length === 0 ? (
            <div className='rounded-control border border-surface-border/70 bg-surface-band/35 px-3 py-2 text-xs text-foreground-muted'>
              No enabled AI provider or model is configured.
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
