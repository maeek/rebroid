import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { firstSearchParamValue } from '@/shared/model/search-params'
import type { ServiceHealth } from '@/shared/contracts/diagnostics'

export type ServicesSearchParams = {
  service?: string | string[]
}

export const loadPlatformServicesPageData = async (searchParams?: Promise<ServicesSearchParams>) => {
  const [initialSettings, initialDisplayHealth, params] = await Promise.all([
    getServerOrchestratorUiSettings(),
    getOrchestratorHealthSummaryAction()
      .then(health => health.services.display)
      .catch(
        (): ServiceHealth => ({
          ok: false,
          status: 'offline',
          message: 'Display service health is unavailable.'
        })
      ),
    searchParams?.then(value => value ?? {}) ?? Promise.resolve<ServicesSearchParams>({})
  ])
  return {
    initialSettings,
    initialDisplayHealth,
    requestedServiceId: firstSearchParamValue(params.service)
  }
}
