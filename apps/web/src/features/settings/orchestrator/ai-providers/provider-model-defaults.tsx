import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { defaultModelFor, modelPurposes } from './provider-model-usage'
import type { AutomationAiProviderModelRole } from './provider-form-model'
import type { AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

export const ProviderModelDefaults = ({
  models,
  savedModels,
  disabled = false,
  loading = false,
  onChange
}: {
  models: AutomationAiProviderModel[]
  savedModels?: AutomationAiProviderModel[]
  disabled?: boolean
  loading?: boolean
  onChange: (index: number, role: AutomationAiProviderModelRole) => void
}) => (
  <Section
    surface='plain'
    title='Defaults by purpose'
    description='Used within this provider when an automation does not select a specific model. Save to apply changes.'
  >
    <div className='grid gap-x-form-column gap-y-6 lg:grid-cols-3'>
      {modelPurposes.map(({ role, label, description }) => {
        const selected = defaultModelFor(models, role)
        const available = models.flatMap((model, index) =>
          model.enabled && model.roles.includes(role) ? [{ model, index }] : []
        )
        return (
          <FormField
            key={role}
            controlId={`default-model-${role}`}
            label={label}
            modified={savedModels ? selected?.id !== defaultModelFor(savedModels, role)?.id : undefined}
            description={description}
            layout='vertical'
          >
            <Select
              value={selected ? String(models.indexOf(selected)) : ''}
              disabled={disabled || available.length === 0}
              onValueChange={value => onChange(Number(value), role)}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder={loading ? 'Loading models…' : 'No enabled model assigned'} />
              </SelectTrigger>
              <SelectContent>
                {available.map(({ model, index }) => (
                  <SelectItem
                    key={index}
                    value={String(index)}
                  >
                    {model.label || model.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )
      })}
    </div>
  </Section>
)
