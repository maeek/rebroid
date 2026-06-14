import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export type AiModelRole = 'planner' | 'vision'
export type AiProviderKind = AutomationAiModelCatalogProvider['kind']
export type AiCatalogModel = AutomationAiModelCatalogProvider['models'][number]

export const catalogByRole = (
  catalog: AutomationAiModelCatalogProvider[],
  role: AiModelRole
): AutomationAiModelCatalogProvider[] =>
  catalog
    .map(provider => ({ ...provider, models: provider.models.filter(model => model.roles?.includes(role)) }))
    .filter(provider => provider.models.length > 0)

export const selectCatalogProvider = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string
): AutomationAiModelCatalogProvider | undefined => catalog.find(provider => provider.id === providerId) ?? catalog[0]

export const selectCatalogModel = (
  provider: AutomationAiModelCatalogProvider | undefined,
  modelId: string
): AutomationAiModelCatalogProvider['models'][number] | undefined =>
  provider?.models.find(model => model.id === modelId) ??
  provider?.models.find(model => model.default) ??
  provider?.models[0]

export const selectCatalogProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  const provider = selectCatalogProvider(catalog, providerId)
  const model = selectCatalogModel(provider, modelId)

  return { provider, model }
}

export const nextCatalogProviderAndModel = (catalog: AutomationAiModelCatalogProvider[], providerId: string) => {
  const provider = selectCatalogProvider(catalog, providerId)
  const model = selectCatalogModel(provider, '')

  return { provider, model }
}

export const aiProviderKindLabel = (kind: AiProviderKind) => {
  if (kind === 'openai') return 'OpenAI'
  if (kind === 'openai-compatible') return 'OpenAI-compatible'
  return 'Ollama'
}

export const aiModelRoleLabel = (role: AiModelRole) => {
  if (role === 'vision') return 'Vision'
  return 'Planner'
}

export const aiProviderDisplayName = (provider: AutomationAiModelCatalogProvider | undefined) =>
  provider?.label || provider?.id || 'No provider'

export const aiModelDisplayName = (model: AiCatalogModel | undefined) => model?.label || model?.id || 'No model'

export const aiModelSubtitle = (
  provider: AutomationAiModelCatalogProvider | undefined,
  model: AiCatalogModel | undefined
) => {
  if (!provider || !model) return 'Configure AI'
  return `${aiProviderKindLabel(provider.kind)} · ${provider.label}`
}
