import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { defaultModelFor, modelPurposes } from './provider-model-usage'
import type { AutomationAiProviderModelRole } from './provider-form-model'
import type { AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

export const ProviderModelDefaults = ({
  models,
  disabled = false,
  loading = false,
  onChange
}: {
  models: AutomationAiProviderModel[]
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
        const available = models.filter(model => model.enabled && model.roles.includes(role))
        return (
          <FormField
            key={role}
            controlId={`default-model-${role}`}
            label={label}
            description={description}
            layout='vertical'
          >
            <Select
              value={defaultModelFor(models, role)?.id ?? ''}
              disabled={disabled || available.length === 0}
              onValueChange={id =>
                onChange(
                  models.findIndex(model => model.id === id),
                  role
                )
              }
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder={loading ? 'Loading models…' : 'No enabled model assigned'} />
              </SelectTrigger>
              <SelectContent>
                {available.map(model => (
                  <SelectItem
                    key={model.id}
                    value={model.id}
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
