import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProviderFormState } from './provider-form-model'

export const ProviderConnectionFields = ({
  provider,
  mode,
  onChange
}: {
  provider: ProviderFormState
  mode: 'create' | 'edit'
  onChange: (patch: Partial<ProviderFormState>) => void
}) => {
  const idPrefix = `provider-${mode}`

  return (
    <div className='grid gap-4'>
      <FormField
        controlId={`${idPrefix}-id`}
        label='Provider ID'
        description='Stable identifier used by automation steps and model selectors.'
        layout='vertical'
      >
        <Input
          value={provider.id}
          placeholder='local-ollama'
          onChange={event => onChange({ id: event.target.value })}
        />
      </FormField>
      <FormField
        controlId={`${idPrefix}-label`}
        label='Label'
        description='Human-readable name shown in tables, editors, and viewer controls.'
        layout='vertical'
      >
        <Input
          value={provider.label}
          placeholder='Local Ollama'
          onChange={event => onChange({ label: event.target.value })}
        />
      </FormField>
      <FormField
        controlId={`${idPrefix}-kind`}
        label='Provider family'
        description={
          mode === 'edit'
            ? 'Used for defaults, downloads, and display. Transport is configured separately.'
            : 'Used for defaults, downloads, and display.'
        }
        layout='vertical'
      >
        <Select
          value={provider.kind}
          onValueChange={kind => onChange({ kind })}
        >
          <SelectTrigger
            id={`${idPrefix}-kind`}
            className='w-full'
            aria-describedby={`${idPrefix}-kind-description`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ollama'>Ollama</SelectItem>
            <SelectItem value='openai'>OpenAI</SelectItem>
            <SelectItem value='openai-compatible'>OpenAI-compatible</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        controlId={`${idPrefix}-protocol`}
        label='Transport protocol'
        description={
          mode === 'edit'
            ? 'Use OpenAI chat completions for llama.cpp, Lemonade, OpenAI, and OpenAI-compatible servers.'
            : 'Use OpenAI chat completions for llama.cpp, Lemonade, and compatible servers.'
        }
        layout='vertical'
      >
        <Select
          value={provider.protocol ?? 'openai-chat-completions'}
          onValueChange={protocol => onChange({ protocol })}
        >
          <SelectTrigger
            id={`${idPrefix}-protocol`}
            className='w-full'
            aria-describedby={`${idPrefix}-protocol-description`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='openai-chat-completions'>OpenAI chat completions</SelectItem>
            <SelectItem value='ollama-native-chat'>Ollama native chat</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        controlId={`${idPrefix}-flavor`}
        label='Server flavor'
        description={
          mode === 'edit'
            ? 'Auto-detection distinguishes Lemonade from its Ollama compatibility endpoints.'
            : 'Auto-detection checks Lemonade before Ollama compatibility endpoints.'
        }
        layout='vertical'
      >
        <Select
          value={provider.serverFlavor ?? 'auto'}
          onValueChange={serverFlavor => onChange({ serverFlavor })}
        >
          <SelectTrigger
            id={`${idPrefix}-flavor`}
            className='w-full'
            aria-describedby={`${idPrefix}-flavor-description`}
          >
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
      </FormField>
      <FormField
        controlId={`${idPrefix}-base-url`}
        label='Base URL'
        description='Use the provider root URL. OpenAI-compatible providers should include their /v1 endpoint.'
        layout='vertical'
      >
        <Input
          value={provider.baseUrl}
          placeholder='http://localhost:11434'
          onChange={event => onChange({ baseUrl: event.target.value })}
        />
      </FormField>
      <FormField
        controlId={`${idPrefix}-api-key`}
        label='API key'
        description={
          mode === 'edit'
            ? 'Stored as a secret. Leave the masked value unchanged to keep the existing key.'
            : 'Stored as a secret. Leave blank for local providers.'
        }
        layout='vertical'
      >
        <Input
          value={provider.apiKey ?? ''}
          placeholder='Leave blank for local providers'
          type='password'
          onChange={event => onChange({ apiKey: event.target.value || null })}
        />
      </FormField>
    </div>
  )
}
