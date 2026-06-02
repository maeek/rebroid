import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { getApplicationAction } from './actions/queries/get-application-action'

export const getApplicationPageData = async (id: string) => {
  const userPromise = getCurrentUserContext()
  const settingsPromise = getServerOrchestratorUiSettings()
  const appPromise = getApplicationAction(id)
    .then(mapAndroidApplicationToAppDefinition)
    .catch(() => undefined)
  const user = await userPromise
  const ownerNamesPromise = getVisibleOwnerDisplayNames(user)
  const [initialSettings, ownerNames, baseApp] = await Promise.all([settingsPromise, ownerNamesPromise, appPromise])
  const app = baseApp
    ? await withStoredAppIcon({
        ...baseApp,
        ownerDisplayName: getOwnerDisplayName(ownerNames, baseApp.ownerUserId)
      })
    : undefined

  return {
    app,
    initialSettings,
    permissions: user.permissions,
    currentOwnerUserId: user.ownerUserId,
    isAdmin: user.role === 'admin'
  }
}
