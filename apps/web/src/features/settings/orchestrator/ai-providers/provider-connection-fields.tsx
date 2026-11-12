import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { providerConnectionDefaults, type ProviderFormState } from './provider-form-model'

export const ProviderConnectionFields = ({
  provider,
  mode,
  onChange,
  onKindChange
}: {
  provider: ProviderFormState
  mode: 'create' | 'edit'
  onChange: (patch: Partial<ProviderFormState>) => void
  onKindChange?: (kind: ProviderFormState['kind']) => void
}) => {
  const idPrefix = `provider-${mode}`
  const openAi = provider.kind === 'openai'
  const defaults = providerConnectionDefaults[provider.kind]

  const changeKind = (kind: ProviderFormState['kind']) => {
    if (onKindChange) {
      onKindChange(kind)
      return
    }
    const next = providerConnectionDefaults[kind]
    onChange({
      kind,
      protocol: next.protocol,
      serverFlavor: next.serverFlavor
    })
  }

  return (
    <div className='grid gap-5'>
      <FormField
        controlId={`${idPrefix}-kind`}
        label='Provider'
        layout='vertical'
      >
        <Select
          value={provider.kind}
          onValueChange={changeKind}
        >
          <SelectTrigger
            id={`${idPrefix}-kind`}
            className='w-full'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='openai'>OpenAI</SelectItem>
            <SelectItem value='ollama'>Ollama</SelectItem>
            <SelectItem value='openai-compatible'>OpenAI-compatible server</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        controlId={`${idPrefix}-api-key`}
        label='API key'
        description={
          mode === 'edit' && provider.apiKey
            ? 'Replace the masked value to change your saved key.'
            : openAi
              ? 'Use an OpenAI API key from the project that will run your workflows.'
              : 'Optional. Enter a key if your server requires one.'
        }
        layout='vertical'
      >
        <Input
          name='apiKey'
          autoComplete='off'
          spellCheck={false}
          value={provider.apiKey ?? ''}
          type='password'
          onChange={event => onChange({ apiKey: event.target.value || null })}
        />
      </FormField>
      <FormField
        controlId={`${idPrefix}-base-url`}
        label='Base URL'
        description={
          openAi ? undefined : 'Use an address reachable by the orchestrator. Compatible servers usually end in /v1.'
        }
        layout='vertical'
      >
        <Input
          name='baseUrl'
          type='url'
          spellCheck={false}
          value={provider.baseUrl}
          placeholder={defaults.baseUrl || 'https://your-server.example/v1'}
          onChange={event => onChange({ baseUrl: event.target.value })}
        />
      </FormField>
      <Section
        surface='plain'
        title='Advanced connection settings'
        headingSpacing='compact'
        collapsible
      >
        <div className='grid gap-x-form-column gap-y-5 sm:grid-cols-2'>
          <FormField
            controlId={`${idPrefix}-label`}
            label='Display name'
            layout='vertical'
          >
            <Input
              name='label'
              value={provider.label}
              onChange={event => onChange({ label: event.target.value })}
            />
          </FormField>
          <FormField
            controlId={`${idPrefix}-id`}
            label='Provider ID'
            description={mode === 'edit' ? 'Used by existing workflows.' : 'Stable identifier used by workflows.'}
            layout='vertical'
          >
            <Input
              name='providerId'
              spellCheck={false}
              value={provider.id}
              readOnly={mode === 'edit'}
              onChange={event => onChange({ id: event.target.value })}
            />
          </FormField>
          {!openAi ? (
            <>
              <FormField
                controlId={`${idPrefix}-protocol`}
                label='Transport protocol'
                layout='vertical'
              >
                <Select
                  value={provider.protocol ?? defaults.protocol}
                  onValueChange={protocol => onChange({ protocol })}
                >
                  <SelectTrigger
                    id={`${idPrefix}-protocol`}
                    className='w-full'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='openai-chat-completions'>OpenAI Chat Completions</SelectItem>
                    <SelectItem value='ollama-native-chat'>Ollama native chat</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                controlId={`${idPrefix}-flavor`}
                label='Server flavor'
                layout='vertical'
              >
                <Select
                  value={provider.serverFlavor ?? defaults.serverFlavor}
                  onValueChange={serverFlavor => onChange({ serverFlavor })}
                >
                  <SelectTrigger
                    id={`${idPrefix}-flavor`}
                    className='w-full'
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
            </>
          ) : null}
        </div>
      </Section>
    </div>
  )
}
