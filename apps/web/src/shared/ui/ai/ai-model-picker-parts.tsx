import { useId, type ComponentProps, type ReactNode } from 'react'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import {
  aiModelDisplayName,
  aiModelRoleLabel,
  aiProviderKindLabel,
  nextCatalogProviderAndModel
} from '@/shared/model/ai-model-catalog'
import { AiHealthIcon, aiHealthLabel } from './ai-health-indicator'
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
}) => {
  const id = useId()
  return (
    <FormField
      label={label}
      layout='vertical'
      controlId={id}
    >
      <Select
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger
          id={id}
          className='w-full'
        >
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
    </FormField>
  )
}

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
}) => {
  const id = useId()
  return (
    <FormField
      label={label}
      layout='vertical'
      controlId={id}
    >
      <Select
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      >
        <SelectTrigger
          id={id}
          className='w-full'
        >
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
    </FormField>
  )
}

const PrimaryModelFields = ({
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
        onChange={onProviderChange}
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

export const VisionModelFields = ({
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
      <PrimaryModelFields
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
