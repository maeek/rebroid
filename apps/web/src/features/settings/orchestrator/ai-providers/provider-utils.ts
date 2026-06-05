import type { AutomationAiProvider, AutomationAiProviderModel } from '@/server/orchestrator/settings/types'

export type ProviderFormState = AutomationAiProvider

export const emptyProvider = (): ProviderFormState => ({
  id: '',
  label: '',
  kind: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: null,
  enabled: false,
  models: []
})

export const emptyModel = (): AutomationAiProviderModel => ({
  id: '',
  label: '',
  supportsVision: false,
  supportsTools: false,
  enabled: true,
  default: false
})

export const inferModelCapabilities = (model: Pick<AutomationAiProviderModel, 'id' | 'label'>) => {
  const value = `${model.id} ${model.label}`.toLowerCase()
  const supportsVision = /\b(vl|vision|visual|multimodal|gpt-4o|o4|llava|pixtral|gemini)\b/.test(value)
  return {
    supportsVision,
    supportsTools: Boolean(model.id.trim())
  }
}

export const normalizeProviderForm = (provider: ProviderFormState): AutomationAiProvider => ({
  ...provider,
  id: provider.id.trim(),
  label: provider.label.trim() || provider.id.trim(),
  baseUrl: provider.baseUrl.trim().replace(/\/+$/, ''),
  apiKey: provider.apiKey?.trim() || null,
  models: provider.models
    .map(model => ({
      ...model,
      id: model.id.trim(),
      label: model.label.trim() || model.id.trim(),
      ...inferModelCapabilities({
        id: model.id.trim(),
        label: model.label.trim() || model.id.trim()
      })
    }))
    .filter(model => model.id.length > 0)
})
