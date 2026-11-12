import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { ProviderConnectionFields } from './provider-connection-fields'
import type { ProviderFormState } from './provider-form-model'

export const ProviderConnectionSection = ({
  provider,
  onChange,
  disabled = false
}: {
  provider: ProviderFormState
  onChange: (patch: Partial<ProviderFormState>) => void
  disabled?: boolean
}) => (
  <Section
    surface='plain'
    title='Connection'
    description='Connect to a hosted API or a local model server.'
  >
    <fieldset
      disabled={disabled}
      className='grid min-w-0 gap-6'
    >
      <FormField
        controlId='provider-edit-enabled'
        label='Available for automation'
        description='Enabled models appear in automation when their purposes match.'
        layout='vertical'
      >
        <Switch
          checked={provider.enabled}
          disabled={disabled}
          onCheckedChange={enabled => onChange({ enabled })}
        />
      </FormField>
      <ProviderConnectionFields
        provider={provider}
        mode='edit'
        onChange={onChange}
      />
    </fieldset>
  </Section>
)
