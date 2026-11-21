import { useId, type ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { aiModelRoleLabel, aiProviderKindLabel } from '@/shared/model/ai-model-catalog'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

const CatalogSelect = ({
  label,
  value,
  disabled,
  placeholder,
  onChange,
  children
}: {
  label: string
  value: string
  disabled?: boolean
  placeholder: string
  onChange: (value: string) => void
  children: ReactNode
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
        <SelectContent>{children}</SelectContent>
      </Select>
    </FormField>
  )
}

export const AiModelCatalogFields = ({
  catalog,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  vision,
  isLoadingCatalog
}: {
  catalog: AutomationAiModelCatalogProvider[]
  selectedProvider?: AutomationAiModelCatalogProvider
  selectedModel?: AutomationAiModelCatalogProvider['models'][number]
  onProviderChange: (providerId: string) => void
  onModelChange: (modelId: string) => void
  vision?: boolean
  isLoadingCatalog?: boolean
}) => {
  const providerPlaceholder = vision ? 'Optional vision provider' : 'Select provider'
  const models = selectedProvider?.models ?? []
  return (
    <>
      {catalog.length > 0 && (catalog.length > 1 || !selectedProvider) ? (
        <CatalogSelect
          label={vision ? 'Vision provider' : 'Provider'}
          value={selectedProvider?.id ?? ''}
          placeholder={isLoadingCatalog ? 'Loading providers...' : providerPlaceholder}
          onChange={onProviderChange}
        >
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
        </CatalogSelect>
      ) : null}
      <CatalogSelect
        label={vision ? 'Vision model' : 'Model'}
        value={selectedModel?.id ?? ''}
        disabled={models.length === 0}
        placeholder={vision ? 'Optional vision model' : 'Select model'}
        onChange={onModelChange}
      >
        {models.map(model => (
          <SelectItem
            key={model.id}
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
        ))}
      </CatalogSelect>
    </>
  )
}
