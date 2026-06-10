import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export type AiModelRole = 'planner' | 'vision'

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
