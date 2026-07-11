'use server'

import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { listVisibleRecentApps } from './service'
import { forgetStoredRecentApp, rememberStoredRecentApp } from './store'

export const listRecentAppsAction = listVisibleRecentApps

export const rememberRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorAppCatalogClient.getApplication(appId)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }

  rememberStoredRecentApp(user.ownerUserId, appId)
  return listVisibleRecentApps()
}

export const forgetRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  forgetStoredRecentApp(user.ownerUserId, appId)
  return listVisibleRecentApps()
}
