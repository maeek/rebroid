import { PlatformServicesPage } from '@/features/platform/services/services-page'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function PlatformServicesRoute() {
  const initialSettings = await getServerOrchestratorUiSettings()
  return <PlatformServicesPage initialSettings={initialSettings} />
}
