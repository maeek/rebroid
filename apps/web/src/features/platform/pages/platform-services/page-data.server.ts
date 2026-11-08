import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { firstSearchParamValue } from '@/shared/model/search-params'

export type ServicesSearchParams = {
  service?: string | string[]
}

export const loadPlatformServicesPageData = async (searchParams?: Promise<ServicesSearchParams>) => {
  const [initialSettings, initialHealth, params] = await Promise.all([
    getServerOrchestratorUiSettings(),
    getOrchestratorHealthSummaryAction().catch(() => null),
    searchParams?.then(value => value ?? {}) ?? Promise.resolve<ServicesSearchParams>({})
  ])
  return {
    initialSettings,
    initialHealth,
    requestedServiceId: firstSearchParamValue(params.service)
  }
}
