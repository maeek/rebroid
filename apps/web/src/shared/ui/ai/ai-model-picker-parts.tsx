import type { ReactNode } from 'react'
import {
  aiModelDisplayName,
  aiModelRoleLabel,
  aiProviderKindLabel,
  nextCatalogProviderAndModel
} from '@rebroid/ai-core/provider'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AiHealthIcon, AiHealthIndicator } from './ai-health-indicator'
import { AiProviderKindBadge } from './ai-model-badges'
import type { AutomationAiModelCatalogProvider, AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

type CatalogModel = AutomationAiModelCatalogProvider['models'][number]

const ModelSelectItem = ({ model }: { model: CatalogModel }) => (
  <SelectItem
    value={model.id}
    label={model.label || model.id}
  >
    <span className='min-w-0 truncate'>{model.label || model.id}</span>
    {model.defaultFor.length > 0 ? (
      <span className='ml-2 text-xs text-foreground-muted'>
        {model.defaultFor.map(aiModelRoleLabel).join('/')} default
      </span>
    ) : null}
  </SelectItem>
)

const ProviderSelect = ({
  catalog,
  disabled,
  label,
  onChange,
  placeholder,
  value
}: {
  catalog: AutomationAiModelCatalogProvider[]
  disabled: boolean
  label: string
  onChange: (providerId: string) => void
  placeholder: string
  value: string
}) => (
  <div className='grid gap-2'>
    <Label>{label}</Label>
    <Select
      value={value}
      disabled={disabled}
      onValueChange={onChange}
    >
      <SelectTrigger className='w-full'>
        <SelectValue placeholder={placeholder} />
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
)

const ModelSelect = ({
  disabled,
  label,
  models,
  onChange,
  placeholder,
  value
}: {
  disabled: boolean
  label: string
  models: CatalogModel[]
  onChange: (modelId: string) => void
  placeholder: string
  value: string
}) => (
  <div className='grid gap-2'>
    <Label>{label}</Label>
    <Select
      value={value}
      disabled={disabled}
      onValueChange={onChange}
    >
      <SelectTrigger className='w-full'>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {models.map(model => (
          <ModelSelectItem
            key={model.id}
            model={model}
          />
        ))}
      </SelectContent>
    </Select>
  </div>
)

const PlannerModelFields = ({
  catalog,
  isLoadingCatalog,
  onModelChange,
  onProviderChange,
  selectedModel,
  selectedProvider
}: {
  catalog: AutomationAiModelCatalogProvider[]
  isLoadingCatalog: boolean
  onModelChange: (modelId: string) => void
  onProviderChange: (providerId: string) => void
  selectedModel?: CatalogModel
  selectedProvider?: AutomationAiModelCatalogProvider
}) => (
  <>
    {catalog.length > 1 ? (
      <ProviderSelect
        label='Provider'
        catalog={catalog}
        value={selectedProvider?.id ?? ''}
        disabled={catalog.length === 0}
        placeholder={isLoadingCatalog ? 'Loading providers...' : 'Select provider'}
        onChange={nextProviderId => {
          const nextSelection = nextCatalogProviderAndModel(catalog, nextProviderId, 'planner')
          onProviderChange(nextProviderId)
          onModelChange(nextSelection.model?.id ?? '')
        }}
      />
    ) : null}
    <ModelSelect
      label='Model'
      models={selectedProvider?.models ?? []}
      value={selectedModel?.id ?? ''}
      disabled={!selectedProvider || selectedProvider.models.length === 0}
      placeholder='Select model'
      onChange={onModelChange}
    />
  </>
)

const VisionModelFields = ({
  onVisionModelChange,
  onVisionProviderChange,
  selectedVisionModel,
  selectedVisionProvider,
  visionCatalog
}: {
  onVisionModelChange: (modelId: string) => void
  onVisionProviderChange: (providerId: string) => void
  selectedVisionModel?: CatalogModel
  selectedVisionProvider?: AutomationAiModelCatalogProvider
  visionCatalog: AutomationAiModelCatalogProvider[]
}) => (
  <>
    {visionCatalog.length > 1 ? (
      <ProviderSelect
        label='Vision provider'
        catalog={visionCatalog}
        value={selectedVisionProvider?.id ?? ''}
        disabled={visionCatalog.length === 0}
        placeholder='Optional vision provider'
        onChange={nextProviderId => {
          const nextSelection = nextCatalogProviderAndModel(visionCatalog, nextProviderId, 'vision')
          onVisionProviderChange(nextProviderId)
          onVisionModelChange(nextSelection.model?.id ?? '')
        }}
      />
    ) : null}
    <ModelSelect
      label='Vision model'
      models={selectedVisionProvider?.models ?? []}
      value={selectedVisionModel?.id ?? ''}
      disabled={!selectedVisionProvider || selectedVisionProvider.models.length === 0}
      placeholder='Optional vision model'
      onChange={onVisionModelChange}
    />
  </>
)

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
    <GradientSparklesIcon className='size-3.5 shrink-0' />
    <span className='min-w-0 truncate text-xs font-medium'>{aiModelDisplayName(selectedModel)}</span>
    {selectedProvider ? (
      <span className='shrink-0 text-xs text-foreground-muted'>{aiProviderKindLabel(selectedProvider.kind)}</span>
    ) : null}
    {health !== undefined || isCheckingHealth ? (
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
  selectedModel
}: {
  health?: AutomationAiProviderHealth | null
  isCheckingHealth?: boolean
  selectedModel?: CatalogModel
}) => (
  <button
    type='button'
    className={cn(
      'inline-flex h-8 min-w-0 max-w-full cursor-pointer items-center justify-start gap-2 rounded-control px-2.5 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
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
        isChecking={Boolean(isCheckingHealth)}
        className='size-3.5'
      />
    ) : null}
    <IconChevronDown className='size-3.5 shrink-0 opacity-60' />
  </button>
)

export const AiModelPickerHeader = ({ selectedProvider }: { selectedProvider?: AutomationAiModelCatalogProvider }) => (
  <div className='flex items-start justify-between gap-3'>
    <div className='grid min-w-0 gap-1'>
      <div className='text-sm font-medium'>AI model</div>
      <div className='min-w-0 truncate text-xs text-foreground-muted'>
        {selectedProvider ? `${selectedProvider.label} · ${aiProviderKindLabel(selectedProvider.kind)}` : 'No provider'}
      </div>
    </div>
    {selectedProvider ? <AiProviderKindBadge kind={selectedProvider.kind} /> : null}
  </div>
)

export const AiModelPickerFields = ({
  advanced,
  catalog,
  isLoadingCatalog = false,
  onModelChange,
  onProviderChange,
  onVisionModelChange,
  onVisionProviderChange,
  selectedModel,
  selectedProvider,
  selectedVisionModel,
  selectedVisionProvider,
  visionCatalog = []
}: {
  advanced?: ReactNode
  catalog: AutomationAiModelCatalogProvider[]
  isLoadingCatalog?: boolean
  onModelChange: (modelId: string) => void
  onProviderChange: (providerId: string) => void
  onVisionModelChange?: (modelId: string) => void
  onVisionProviderChange?: (providerId: string) => void
  selectedModel?: CatalogModel
  selectedProvider?: AutomationAiModelCatalogProvider
  selectedVisionModel?: CatalogModel
  selectedVisionProvider?: AutomationAiModelCatalogProvider
  visionCatalog?: AutomationAiModelCatalogProvider[]
}) => {
  const hasVisionPicker = Boolean(onVisionProviderChange && onVisionModelChange)

  return (
    <div className='grid gap-3'>
      <PlannerModelFields
        catalog={catalog}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        isLoadingCatalog={isLoadingCatalog}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />

      {hasVisionPicker && onVisionProviderChange && onVisionModelChange ? (
        <VisionModelFields
          visionCatalog={visionCatalog}
          selectedVisionProvider={selectedVisionProvider}
          selectedVisionModel={selectedVisionModel}
          onVisionProviderChange={onVisionProviderChange}
          onVisionModelChange={onVisionModelChange}
        />
      ) : null}

      {advanced ? <div className='grid gap-2'>{advanced}</div> : null}
    </div>
  )
}

export const AiModelPickerHealthFooter = ({
  health,
  isCheckingHealth,
  label = 'Planner health',
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
    <AiHealthIndicator
      health={health ?? null}
      isChecking={Boolean(isCheckingHealth)}
      label={label}
      action={
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          className='size-8'
          disabled={!selectedModel || isCheckingHealth}
          aria-label='Re-check planner health'
          onClick={onRecheckHealth}
        >
          <IconRefresh className={isCheckingHealth ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      }
    />
  )
}
