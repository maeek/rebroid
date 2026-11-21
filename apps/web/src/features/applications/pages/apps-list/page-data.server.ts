import { withStoredAppIcons } from '@/features/applications/icons/enrich'
import { toActionError } from '@/server/actions/safe-action'
import { getRequestId } from '@/server/observability/request-id'
import { listApplicationGallery } from '@/server/orchestrator/applications/application-gallery-query'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { toAppGalleryItem } from '@/shared/contracts/application-gallery'
import { hasPermission } from '@/shared/permissions/permissions'

export const getAppsListPageData = async () => {
  const initialSettingsPromise = getServerOrchestratorUiSettings()
  const user = await getCurrentUserContext()
  let orchestratorError: string | null = null
  const appsPromise = listApplicationGallery(user)
    .then(rows => withStoredAppIcons(rows.map(toAppGalleryItem)))
    .catch(async error => {
      const failure = toActionError(error, await getRequestId(), 'Could not load applications.')
      orchestratorError = `${failure.message} Reference: ${failure.requestId}`
      return []
    })
  const [initialSettings, apps] = await Promise.all([initialSettingsPromise, appsPromise])

  return {
    apps,
    canCreate: hasPermission(user.permissions, 'applications:create'),
    canStart: hasPermission(user.permissions, 'applications:start'),
    canStop: hasPermission(user.permissions, 'applications:stop'),
    canDelete: hasPermission(user.permissions, 'applications:delete'),
    canViewSnapshots: hasPermission(user.permissions, 'applications:capture-screenshot'),
    canFilterByOwner: user.isPlatformAdmin,
    currentOwnerUserId: user.ownerUserId,
    initialSettings,
    orchestratorError
  }
}
