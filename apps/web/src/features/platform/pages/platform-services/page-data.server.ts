import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { loadServiceContainerIds } from '@/server/orchestrator/platform/service-containers'
import { firstSearchParamValue } from '@/shared/model/search-params'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export type ServicesSearchParams = {
  service?: string | string[]
}

export const loadPlatformServicesPageData = async (searchParams?: Promise<ServicesSearchParams>) => {
  const [health, params] = await Promise.all([
    readOrchestratorPage(getOrchestratorHealthSummaryAction),
    searchParams ?? Promise.resolve<ServicesSearchParams>({})
  ])
  const requestedServiceId = firstSearchParamValue(params.service)
  const fallbackSettings = { ...defaultOrchestratorUiSettings, orchestratorApiUrl: getOrchestratorBaseUrl() }
  let initialSettings = fallbackSettings
  let initialHealth = health.ok ? health.data : null
  let requestId = health.ok ? undefined : health.failure.requestId
  if (initialHealth?.services.orchestrator.ok && requestedServiceId !== 'orchestrator') {
    const settings = await readOrchestratorPage(getRequiredServerOrchestratorUiSettings)
    if (settings.ok) initialSettings = settings.data
    else {
      initialHealth = null
      requestId = settings.failure.requestId
    }
  }
  const containerIds = await loadServiceContainerIds(initialHealth, { settings: initialSettings.services })
  return { initialSettings, initialHealth, requestedServiceId, requestId, containerIds }
}
