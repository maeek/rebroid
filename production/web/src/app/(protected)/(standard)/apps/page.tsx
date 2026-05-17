import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcons } from '@/features/applications/icons/enrich'
import { AppsList } from '@/features/applications/list/apps-list'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

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
