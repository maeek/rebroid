import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { DockerContainerLinks } from '@/shared/ui/platform/docker-container-links'
import { ProviderConnectionFields } from './provider-connection-fields'
import type { ProviderFormState } from './provider-form-model'

export const ProviderConnectionSection = ({
  provider,
  containerId,
  onChange,
  disabled = false
}: {
  provider: ProviderFormState
  containerId?: string
  onChange: (patch: Partial<ProviderFormState>) => void
  disabled?: boolean
}) => (
  <Section
    surface='plain'
    title='Connection'
    description='Connect to a hosted API or a local model server.'
    actions={
      containerId ? (
        <DockerContainerLinks
          containerId={containerId}
          className='max-sm:flex-col max-sm:items-end'
        />
      ) : undefined
    }
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
