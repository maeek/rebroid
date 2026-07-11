import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export type ServicesSearchParams = {
  service?: string | string[]
}

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export const loadPlatformServicesPageData = async (searchParams?: Promise<ServicesSearchParams>) => {
  const [initialSettings, params] = await Promise.all([
    getServerOrchestratorUiSettings(),
    searchParams?.then(value => value ?? {}) ?? Promise.resolve<ServicesSearchParams>({})
  ])
  return { initialSettings, requestedServiceId: firstValue(params.service) }
}
