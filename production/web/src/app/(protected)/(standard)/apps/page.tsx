import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { withStoredAppIcons } from '@/lib/app-icons/enrich'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { AppsList } from '../../_components/apps/apps-list'

export default async function Apps() {
  const initialSettings = await getServerOrchestratorUiSettings()
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  let orchestratorError: string | null = null
  const apps = await orchestratorApplicationsClient
    .listApplications(ownerUserId)
    .then(items => items.map(mapAndroidApplicationToAppDefinition))
    .then(withStoredAppIcons)
    .catch(error => {
      orchestratorError = error instanceof Error ? error.message : 'The orchestrator API is not responding.'
      return []
    })

  return (
    <ProtectedStackPageLayout>
      <AppsList
        yourApps={apps}
        initialSettings={initialSettings}
        orchestratorError={orchestratorError}
      />
    </ProtectedStackPageLayout>
  )
}
