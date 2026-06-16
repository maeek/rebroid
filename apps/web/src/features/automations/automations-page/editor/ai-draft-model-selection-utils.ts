import { selectCatalogProviderAndModel } from '@rebroid/ai-core/provider'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const selectAiDraftProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  return selectCatalogProviderAndModel(catalog, providerId, modelId, 'planner')
}
