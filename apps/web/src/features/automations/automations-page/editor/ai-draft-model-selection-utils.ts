import { selectCatalogProviderAndModel } from '@/shared/automation/automation-ai-catalog'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const selectAiDraftProviderAndModel = (
  catalog: AutomationAiModelCatalogProvider[],
  providerId: string,
  modelId: string
) => {
  return selectCatalogProviderAndModel(catalog, providerId, modelId)
}
