import { catalogByRole, selectCatalogProviderAndModel } from '@/shared/model/ai-model-catalog'
import type { AutomationAiModelCatalogProvider } from '@/shared/contracts/ai-provider'

export const selectAiDraftProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  const planningCatalog = catalogByRole(catalog, 'planner')
  return {
    ...selectCatalogProviderAndModel(planningCatalog, providerId, modelId, 'planner'),
    catalog: planningCatalog
  }
}
