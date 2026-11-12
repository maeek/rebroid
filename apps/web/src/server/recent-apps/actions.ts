'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { isApplicationId } from '@/shared/model/application-id'
import { listVisibleRecentApps } from './service'
import { dismissStoredRecentApp, rememberStoredRecentApp } from './store'

const getRecentAppUser = async (appId: string) => {
  const user = await getCurrentUserContext()
  if (!isApplicationId(appId)) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }
  const app = await orchestratorAppCatalogClient.getApplication(appId)
  if (!user.isPlatformAdmin && app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }
  return user
}

export const rememberRecentAppAction = async (appId: string) => {
  const user = await getRecentAppUser(appId)
  rememberStoredRecentApp(user.ownerUserId, appId)
  return listVisibleRecentApps()
}

export const dismissRecentAppAction = async (appId: string) =>
  runSafeAction(
    async () => {
      const user = await getRecentAppUser(appId)
      dismissStoredRecentApp(user.ownerUserId, appId)
    },
    { fallbackMessage: 'Could not remove the app from recent.' }
  )
