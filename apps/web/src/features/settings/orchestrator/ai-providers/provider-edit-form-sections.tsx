import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { ProviderConnectionFields } from './provider-connection-fields'
import type { ProviderFormState } from './provider-form-model'

export const ProviderEnabledSection = ({
  enabled,
  onChange
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}) => (
  <Section
    surface='panel'
    contentClassName='gap-5'
  >
    <FormField
      controlId='provider-edit-enabled'
      label='Enabled'
      description='Enabled providers with enabled models appear in automation editors.'
      layout='horizontal'
    >
      <Switch
        className='shrink-0'
        checked={enabled}
        onCheckedChange={onChange}
      />
    </FormField>
  </Section>
)

export const ProviderConnectionSection = ({
  provider,
  onChange
}: {
  provider: ProviderFormState
  onChange: (patch: Partial<ProviderFormState>) => void
}) => (
  <Section
    surface='plain'
    contentClassName='gap-5'
  >
    <div>
      <h3 className='text-sm font-medium'>Provider</h3>
      <p className='text-xs text-foreground-muted'>
        Local providers can use Ollama or any OpenAI-compatible /v1 endpoint.
      </p>
    </div>
    <ProviderConnectionFields
      provider={provider}
      mode='edit'
      onChange={onChange}
    />
  </Section>
)
