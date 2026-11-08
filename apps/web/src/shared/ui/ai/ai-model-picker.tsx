'use client'

import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AiModelMenu } from './ai-model-menu'
import {
  AiModelPickerHealthFooter,
  AiModelPickerReadonlyChip,
  AiModelPickerTrigger,
  VisionModelFields
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
  const [open, setOpen] = useState(defaultOpen ?? false)
  const hasVisionPicker = Boolean(onVisionProviderChange && onVisionModelChange)
  const showReadOnlyPlannerChip =
    !trigger &&
    !hasVisionPicker &&
    !advanced &&
    !onRecheckHealth &&
    catalog.length === 1 &&
    (selectedProvider?.models.length ?? 0) <= 1

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
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
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
        side='top'
        align='end'
        aria-label='Choose AI model'
        className='max-h-[var(--available-height)] w-[min(calc(100vw-2rem),22rem)] overflow-y-auto overscroll-contain p-2'
      >
        <div className='grid gap-3'>
          <AiModelMenu
            catalog={catalog}
            providerId={selectedProvider?.id}
            modelId={selectedModel?.id}
            onSelect={(providerId, modelId) => {
              onProviderChange(providerId)
              onModelChange(modelId)
              setOpen(false)
            }}
          />
          {advanced || (hasVisionPicker && visionCatalog.length > 0) ? (
            <details className='group px-2'>
              <summary className='cursor-pointer rounded-control py-2 text-xs text-foreground-muted outline-none focus-visible:ring-2 focus-visible:ring-ring'>
                More options
              </summary>
              <div className='grid gap-4 pb-2 pt-3'>
                {visionCatalog.length > 0 && onVisionProviderChange && onVisionModelChange ? (
                  <VisionModelFields
                    visionCatalog={visionCatalog}
                    selectedVisionProvider={selectedVisionProvider}
                    selectedVisionModel={selectedVisionModel}
                    onVisionProviderChange={onVisionProviderChange}
                    onVisionModelChange={onVisionModelChange}
                  />
                ) : null}
                {advanced}
              </div>
            </details>
          ) : null}
          <AiModelPickerHealthFooter
            health={health}
            isCheckingHealth={isCheckingHealth}
            selectedModel={selectedModel}
            onRecheckHealth={onRecheckHealth}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
