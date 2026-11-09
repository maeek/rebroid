import { unstable_rethrow } from 'next/navigation'
import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { getRequiredServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { firstSearchParamValue } from '@/shared/model/search-params'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export type ServicesSearchParams = {
  service?: string | string[]
}

export const loadPlatformServicesPageData = async (searchParams?: Promise<ServicesSearchParams>) => {
  const [health, params] = await Promise.all([
    getOrchestratorHealthSummaryAction().catch(error => {
      unstable_rethrow(error)
      if (error instanceof OrchestratorRequestError && error.status >= 500) return null
      throw error
    }),
    searchParams?.then(value => value ?? {}) ?? Promise.resolve<ServicesSearchParams>({})
  ])
  const requestedServiceId = firstSearchParamValue(params.service)
  const fallbackSettings = { ...defaultOrchestratorUiSettings, orchestratorApiUrl: getOrchestratorBaseUrl() }
  let initialSettings = fallbackSettings
  let initialHealth = health
  if (health?.services.orchestrator.ok && requestedServiceId !== 'docker' && requestedServiceId !== 'orchestrator') {
    try {
      initialSettings = await getRequiredServerOrchestratorUiSettings()
    } catch (error) {
      unstable_rethrow(error)
      if (!(error instanceof OrchestratorRequestError && error.status >= 500)) throw error
      initialHealth = null
    }
  }
  return {
    initialSettings,
    initialHealth,
    requestedServiceId
  }
}
