'use server'

import { compareAppNames } from '@/features/applications/domain/app-sort'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
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

const navigationAppsLimit = 5

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
  const appsById = new Map(apps.map(app => [app.id, app]))

  const runningApps = apps
    .filter(app => app.currentStatus === 'running')
    .toSorted(compareAppNames)
    .slice(0, navigationAppsLimit)
  const runningIds = new Set(runningApps.map(app => app.id))
  const recentApps = recent
    .map(item => {
      const app = appsById.get(item.id)
      return app && !runningIds.has(app.id) ? { app, openedAt: item.openedAt } : null
    })
    .filter((item): item is { app: AndroidApplicationSummary; openedAt: number } => Boolean(item))
    .slice(0, navigationAppsLimit - runningApps.length)

  return Promise.all(
    [
      ...runningApps.map(app => ({ app, openedAt: recent.find(item => item.id === app.id)?.openedAt ?? 0 })),
      ...recentApps
    ].map(item => toRecentApp(item.app, item.openedAt))
  )
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
