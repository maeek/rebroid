import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const selectAiDraftProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  const provider = catalog.find(item => item.id === providerId) ?? catalog[0]
  const model =
    provider?.models.find(item => item.id === modelId) ??
    provider?.models.find(item => item.default) ??
    provider?.models[0]
  return { provider, model }
}
