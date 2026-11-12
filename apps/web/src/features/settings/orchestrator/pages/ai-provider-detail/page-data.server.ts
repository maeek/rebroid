import { loadEndpointContainerId } from '@/server/orchestrator/platform/service-containers'
import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const getAiProviderDetailPageData = async (
  providerId: string,
  health: OrchestratorHealth,
  view: 'models' | 'connection'
) => {
  const providers = await listAutomationAiProvidersAction()
  const provider = providers.find(item => item.id === decodeURIComponent(providerId))

  return {
    provider,
    containerId: provider && view === 'connection' ? await loadEndpointContainerId(health, provider.baseUrl) : undefined
  }
}
