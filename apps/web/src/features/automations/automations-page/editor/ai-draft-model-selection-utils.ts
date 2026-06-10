import { selectCatalogModel, selectCatalogProvider } from '@/shared/automation/automation-ai-catalog'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const selectAiDraftProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  const provider = selectCatalogProvider(catalog, providerId)
  const model = selectCatalogModel(provider, modelId)
  return { provider, model }
}
