import type { AutomationAiProvider, AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

export type AutomationAiProviderModelRole = AutomationAiProviderModel['roles'][number]
export type ProviderFormState = AutomationAiProvider
export type ProviderModelRow = AutomationAiProviderModel & {
  rowId: string
  index: number
}

export const emptyProvider = (): ProviderFormState => ({
  id: '',
  label: '',
  kind: 'ollama',
  protocol: 'openai-chat-completions',
  serverFlavor: 'auto',
  baseUrl: 'http://localhost:11434',
  apiKey: null,
  enabled: false,
  models: []
})

export const emptyModel = (): AutomationAiProviderModel => ({
  id: '',
  label: '',
  roles: ['controller' as const, 'planner' as const],
  settings: {},
  enabled: true,
  defaultFor: []
})

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
      roles: Array.isArray(model.roles) ? model.roles : (['controller', 'planner'] as AutomationAiProviderModelRole[]),
      defaultFor: Array.isArray(model.defaultFor)
        ? model.defaultFor.filter(role => (model.roles ?? []).includes(role))
        : [],
      settings: model.settings ?? {}
    }))
    .filter(model => model.id.length > 0)
})

export const createProviderModelRows = (models: AutomationAiProviderModel[]): ProviderModelRow[] =>
  models.map((model, index) => ({
    ...model,
    index,
    rowId: `${index}:${model.id || 'new'}`
  }))

export const updateProviderModelAt = (
  models: AutomationAiProviderModel[],
  index: number,
  patch: Partial<AutomationAiProviderModel>
) =>
  models.map((model, modelIndex) => {
    const nextModel = modelIndex === index ? { ...model, ...patch } : model
    if (patch.roles) {
      nextModel.defaultFor = nextModel.defaultFor.filter(role => patch.roles?.includes(role))
    }
    if (!patch.defaultFor) return nextModel
    return {
      ...nextModel,
      defaultFor:
        modelIndex === index ? patch.defaultFor : nextModel.defaultFor.filter(role => !patch.defaultFor?.includes(role))
    }
  })

export const setDefaultProviderModelAt = (
  models: AutomationAiProviderModel[],
  index: number,
  role: AutomationAiProviderModelRole
) =>
  models.map((model, modelIndex) => ({
    ...model,
    defaultFor:
      modelIndex === index
        ? Array.from(new Set([...model.defaultFor, role])).filter(item => model.roles.includes(item))
        : model.defaultFor.filter(item => item !== role)
  }))
