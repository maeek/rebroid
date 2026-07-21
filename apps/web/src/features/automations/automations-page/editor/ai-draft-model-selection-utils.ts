import { selectCatalogProviderAndModel } from '@/shared/model/ai-model-catalog'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

export const selectAiDraftProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  return selectCatalogProviderAndModel(catalog, providerId, modelId, 'planner')
}
