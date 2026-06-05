import { type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ProviderFormState } from './provider-utils'

export const ProviderEnabledSection = ({
  enabled,
  onChange
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}) => (
  <Section
    boxed
    contentClassName='gap-5'
  >
    <div className='flex items-center justify-between gap-4'>
      <div>
        <Label>Enabled</Label>
        <p className='text-xs text-secondary-foreground'>
          Enabled providers with enabled models appear in automation editors.
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
      />
    </div>
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
    boxed
    contentClassName='gap-5'
  >
    <div>
      <h3 className='text-sm font-semibold'>Provider</h3>
      <p className='text-xs text-secondary-foreground'>
        Local providers can use Ollama or any OpenAI-compatible /v1 endpoint.
      </p>
    </div>
    <div className='grid gap-4'>
      <Field
        label='Provider ID'
        description='Stable identifier used by automation steps and model selectors.'
      >
        <Input
          value={provider.id}
          placeholder='local-ollama'
          onChange={event => onChange({ id: event.target.value })}
        />
      </Field>
      <Field
        label='Label'
        description='Human-readable name shown in tables, editors, and viewer controls.'
      >
        <Input
          value={provider.label}
          placeholder='Local Ollama'
          onChange={event => onChange({ label: event.target.value })}
        />
      </Field>
      <Field
        label='Kind'
        description='Select the API protocol used by this provider.'
      >
        <Select
          value={provider.kind}
          onValueChange={kind => onChange({ kind: kind as ProviderFormState['kind'] })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ollama'>Ollama</SelectItem>
            <SelectItem value='openai'>OpenAI</SelectItem>
            <SelectItem value='openai-compatible'>OpenAI-compatible</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        label='Base URL'
        description='Use the provider root URL. OpenAI-compatible providers should include their /v1 endpoint.'
      >
        <Input
          value={provider.baseUrl}
          placeholder='http://localhost:11434'
          onChange={event => onChange({ baseUrl: event.target.value })}
        />
      </Field>
      <Field
        label='API key'
        description='Stored as a secret. Leave the masked value unchanged to keep the existing key.'
      >
        <Input
          value={provider.apiKey ?? ''}
          placeholder='Leave blank for local providers'
          type='password'
          onChange={event => onChange({ apiKey: event.target.value || null })}
        />
      </Field>
    </div>
  </Section>
)

const Field = ({ label, description, children }: { label: string; description: string; children: ReactNode }) => (
  <div className='grid gap-2'>
    <div className='grid gap-1'>
      <Label>{label}</Label>
      <p className='text-xs text-secondary-foreground'>{description}</p>
    </div>
    {children}
  </div>
)
