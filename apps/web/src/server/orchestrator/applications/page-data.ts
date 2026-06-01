import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import { userService } from '@/server/auth/user'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { getApplicationAction } from './read-actions'

export const getApplicationPageData = async (id: string) => {
  const userPromise = getCurrentUserContext()
  const settingsPromise = getServerOrchestratorUiSettings()
  const appPromise = getApplicationAction(id)
    .then(mapAndroidApplicationToAppDefinition)
    .catch(() => undefined)
  const user = await userPromise
  const ownerNamesPromise =
    user.role === 'admin'
      ? userService.listUsers().then(owners => new Map(owners.map(owner => [owner.id, owner.name || owner.username])))
      : Promise.resolve(new Map<string, string>())
  const [initialSettings, ownerNames, baseApp] = await Promise.all([settingsPromise, ownerNamesPromise, appPromise])
  const app = baseApp
    ? await withStoredAppIcon({
        ...baseApp,
        ownerDisplayName: baseApp.ownerUserId ? (ownerNames.get(baseApp.ownerUserId) ?? baseApp.ownerUserId) : null
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
