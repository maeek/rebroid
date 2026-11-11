'use server'

import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { listVisibleRecentApps } from './service'
import { rememberStoredRecentApp } from './store'

export const listRecentAppsAction = listVisibleRecentApps

export const rememberRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorAppCatalogClient.getApplication(appId)
  if (!user.isPlatformAdmin && app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }

  rememberStoredRecentApp(user.ownerUserId, appId)
  return listVisibleRecentApps()
}
