import { PlatformServicesPage } from '@/features/platform/services/services-page'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

type ServicesSearchParams = {
  service?: string | string[]
}

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function PlatformServicesRoute({
  searchParams
}: {
  searchParams?: Promise<ServicesSearchParams>
}) {
  const initialSettings = await getServerOrchestratorUiSettings()
  const params = (await searchParams) ?? {}
  return (
    <PlatformServicesPage
      initialSettings={initialSettings}
      requestedServiceId={firstValue(params.service)}
    />
  )
}
