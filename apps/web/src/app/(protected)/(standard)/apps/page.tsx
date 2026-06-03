import { Suspense } from 'react'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcons } from '@/features/applications/icons/enrich'
import { AppsList } from '@/features/applications/list/apps-list'
import { AppsPageSkeleton } from '@/features/applications/list/apps-page-skeleton'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'

const AppsPageContent = async () => {
  const initialSettingsPromise = getServerOrchestratorUiSettings()
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const ownerNamesPromise = getVisibleOwnerDisplayNames(user)
  let orchestratorError: string | null = null
  const appsPromise = orchestratorAppCatalogClient
    .listApplications(ownerUserId, false)
    .then(items => items.map(mapAndroidApplicationToAppDefinition))
    .catch(error => {
      orchestratorError = error instanceof Error ? error.message : 'The orchestrator API is not responding.'
      return []
    })
  const [initialSettings, ownerNames, baseApps] = await Promise.all([
    initialSettingsPromise,
    ownerNamesPromise,
    appsPromise
  ])
  const apps = await Promise.resolve(baseApps)
    .then(items =>
      items.map(app => ({
        ...app,
        ownerDisplayName: getOwnerDisplayName(ownerNames, app.ownerUserId)
      }))
    )
    .then(withStoredAppIcons)
    .catch(error => {
      orchestratorError = error instanceof Error ? error.message : 'The orchestrator API is not responding.'
      return []
    })

  return (
    <AppsList
      yourApps={apps}
      currentOwnerUserId={user.ownerUserId}
      initialSettings={initialSettings}
      orchestratorError={orchestratorError}
    />
  )
}

export default function Apps() {
  return (
    <ProtectedStackPageLayout>
      <Suspense fallback={<AppsPageSkeleton withLayout={false} />}>
        <AppsPageContent />
      </Suspense>
    </ProtectedStackPageLayout>
  )
}
