import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { ServiceConnectionLinks } from '@/shared/ui/platform/service-connection-links'
import { ProviderBillingIssueNotice } from './provider-billing-issue'
import { ProviderConnectionFields } from './provider-connection-fields'
import type { ProviderFormState } from './provider-form-model'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

export const ProviderConnectionSection = ({
  provider,
  billingIssue,
  containerId,
  onChange,
  disabled = false
}: {
  provider: ProviderFormState
  billingIssue?: AutomationAiProvider['billingIssue']
  containerId?: string
  onChange: (patch: Partial<ProviderFormState>) => void
  disabled?: boolean
}) => (
  <Section
    surface='plain'
    title='Connection'
    description='Connect to a hosted API or a local model server.'
  >
    {billingIssue ? <ProviderBillingIssueNotice issue={billingIssue} /> : null}
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
    <ServiceConnectionLinks containerId={containerId} />
  </Section>
)
