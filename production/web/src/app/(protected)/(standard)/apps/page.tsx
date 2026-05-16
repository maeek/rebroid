import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { withStoredAppIcons } from '@/lib/app-icons/enrich'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { orchestratorApi } from '@/lib/orchestrator/client'
import { getCurrentOwnerUserId } from '@/lib/orchestrator/current-owner'
import { getServerOrchestratorUiSettings } from '@/lib/orchestrator/server-settings'
import { AppsList } from '../../_components/apps/apps-list'

export default async function Apps() {
  const initialSettings = await getServerOrchestratorUiSettings()
  const ownerUserId = await getCurrentOwnerUserId()
  const apps = await orchestratorApi
    .listApplications(ownerUserId)
    .then(items => items.map(mapAndroidApplicationToAppDefinition))
    .then(withStoredAppIcons)
    .catch(() => [])

  return (
    <ProtectedStackPageLayout>
      <AppsList
        yourApps={apps}
        initialSettings={initialSettings}
      />
    </ProtectedStackPageLayout>
  )
}
