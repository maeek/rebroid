import { loadExternalDeviceInventory } from '@/server/orchestrator/external-devices/operations'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ExternalDevicesPage } from './page-client'

export async function renderExternalDevicesPage(openRegistration = false) {
  const result = await readOrchestratorPage(() => loadExternalDeviceInventory())
  if (!result.ok)
    return (
      <PlatformRouteUnavailable
        title='Devices'
        description='Could not load the external device inventory.'
        requestId={result.failure.requestId}
        section={{ label: 'Devices', href: '/devices' }}
      />
    )
  const { devices, ...access } = result.data
  return (
    <ExternalDevicesPage
      initialDevices={devices}
      openRegistration={openRegistration}
      {...access}
    />
  )
}

export const ExternalDevicesPageEntry = () => renderExternalDevicesPage()
