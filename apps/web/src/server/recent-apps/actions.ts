'use server'

import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { listVisibleRecentApps } from './service'
import { forgetStoredRecentApp, rememberStoredRecentApp } from './store'

export const listRecentAppsAction = listVisibleRecentApps

export const rememberRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorAppCatalogClient.getApplication(appId)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }

  rememberStoredRecentApp(user.ownerUserId, appId)
  return listVisibleRecentApps()
}

export const forgetRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  forgetStoredRecentApp(user.ownerUserId, appId)
  return listVisibleRecentApps()
}
