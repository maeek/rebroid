import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { firstSearchParamValue } from '@/shared/model/search-params'

export type ServicesSearchParams = {
  service?: string | string[]
}

export const loadPlatformServicesPageData = async (searchParams?: Promise<ServicesSearchParams>) => {
  const [initialSettings, params] = await Promise.all([
    getServerOrchestratorUiSettings(),
    searchParams?.then(value => value ?? {}) ?? Promise.resolve<ServicesSearchParams>({})
  ])
  return { initialSettings, requestedServiceId: firstSearchParamValue(params.service) }
}
