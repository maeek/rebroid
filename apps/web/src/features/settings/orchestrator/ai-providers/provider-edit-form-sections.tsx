import { type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ProviderFormState } from '@rebroid/ai-core/provider'

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
    <div className='flex items-start justify-between gap-4'>
      <div className='min-w-0 flex-1'>
        <Label>Enabled</Label>
        <p className='text-xs text-foreground-muted'>
          Enabled providers with enabled models appear in automation editors.
        </p>
      </div>
      <Switch
        className='shrink-0'
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
  <Section contentClassName='gap-5'>
    <div>
      <h3 className='text-sm font-semibold'>Provider</h3>
      <p className='text-xs text-foreground-muted'>
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
        label='Provider family'
        description='Used for defaults, downloads, and display. Transport is configured separately.'
      >
        <Select
          value={provider.kind}
          onValueChange={kind => onChange({ kind: kind })}
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
        label='Transport protocol'
        description='Use OpenAI chat completions for llama.cpp, Lemonade, OpenAI, and OpenAI-compatible servers.'
      >
        <Select
          value={provider.protocol ?? 'openai-chat-completions'}
          onValueChange={protocol => onChange({ protocol })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='openai-chat-completions'>OpenAI chat completions</SelectItem>
            <SelectItem value='ollama-native-chat'>Ollama native chat</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        label='Server flavor'
        description='Auto-detection distinguishes Lemonade from its Ollama compatibility endpoints.'
      >
        <Select
          value={provider.serverFlavor ?? 'auto'}
          onValueChange={serverFlavor => onChange({ serverFlavor })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='auto'>Auto-detect</SelectItem>
            <SelectItem value='lemonade'>Lemonade</SelectItem>
            <SelectItem value='llama-cpp'>llama.cpp</SelectItem>
            <SelectItem value='ollama'>Ollama</SelectItem>
            <SelectItem value='openai'>OpenAI</SelectItem>
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
      <p className='text-xs text-foreground-muted'>{description}</p>
    </div>
    {children}
  </div>
)
