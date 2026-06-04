'use server'

import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { navigationAppsLimit, selectNavigationAppEntries } from './navigation'
import { forgetStoredRecentApp, listStoredRecentApps, rememberStoredRecentApp } from './store'
import type { AndroidApplicationSummary } from '@/server/orchestrator/applications/types'

export type RecentApp = {
  id: string
  name: string
  icon?: string | null
  openedAt: number
  status?: 'provisioning' | 'running' | 'stopped' | 'error' | 'removing' | 'removed'
  statusLabel?: string | null
}

const toRecentApp = async (app: AndroidApplicationSummary, openedAt: number): Promise<RecentApp> => ({
  id: app.id,
  name: app.name,
  icon: await getStoredAppIcon(app.id),
  openedAt,
  status: app.currentStatus,
  statusLabel: app.detail?.title ?? null
})

const visibleRecentApps = async (userId: string): Promise<RecentApp[]> => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const [recent, apps] = await Promise.all([
    listStoredRecentApps(userId),
    orchestratorAppCatalogClient.listApplicationSummaries(ownerUserId)
  ])
  const navigationApps = selectNavigationAppEntries(apps, recent, navigationAppsLimit)

  return Promise.all(navigationApps.map(item => toRecentApp(item.app, item.openedAt)))
}

export const listRecentAppsAction = async () => {
  const user = await getCurrentUserContext()
  return visibleRecentApps(user.ownerUserId)
}

export const rememberRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorAppCatalogClient.getApplication(appId)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }

  await rememberStoredRecentApp(user.ownerUserId, appId)
  return visibleRecentApps(user.ownerUserId)
}

export const forgetRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  await forgetStoredRecentApp(user.ownerUserId, appId)
  return visibleRecentApps(user.ownerUserId)
}
