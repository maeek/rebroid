import 'server-only'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { getAppStatusLabel } from '@/shared/model/applications/app-status-label'
import { hasPermission } from '@/shared/permissions/permissions'
import { navigationAppsLimit, selectNavigationAppEntries, selectRecentlyOpenedAppEntries } from './navigation'
import { listDismissedRecentAppIds, listStoredRecentApps } from './store'
import type { AndroidApplicationSummary } from '@/shared/contracts/application'
import type { RecentApp } from '@/shared/contracts/recent-app'

const toRecentApp = async (
  app: AndroidApplicationSummary,
  openedAt: number,
  statusLabel: string | null
): Promise<RecentApp> => ({
  id: app.id,
  name: app.name,
  icon: await getStoredAppIcon(app.id),
  openedAt,
  status: app.currentStatus,
  statusLabel
})

const listVisibleApps = async (recentOnly: boolean): Promise<RecentApp[]> => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.isPlatformAdmin ? undefined : user.ownerUserId
  const recent = listStoredRecentApps(user.ownerUserId)
  if (recentOnly && recent.length === 0) return []

  const dismissedIds = recentOnly ? undefined : listDismissedRecentAppIds(user.ownerUserId)
  const apps = await orchestratorAppCatalogClient.listApplicationSummaries(ownerUserId, {
    applicationIds: recent.map(app => app.id),
    includeRunning: !recentOnly
  })
  const navigationApps = recentOnly
    ? selectRecentlyOpenedAppEntries(apps, recent)
    : selectNavigationAppEntries(
        apps.filter(app => !dismissedIds?.has(app.id)),
        recent,
        navigationAppsLimit
      )
  const otherOwnerIds = new Set<string>()
  for (const { app } of navigationApps) {
    if (app.ownerUserId && app.ownerUserId !== user.ownerUserId) otherOwnerIds.add(app.ownerUserId)
  }
  const ownerNames = await getVisibleOwnerDisplayNames(user, [...otherOwnerIds])

  return Promise.all(
    navigationApps.map(async ({ app, openedAt }) => {
      const statusLabel = recentOnly
        ? getAppStatusLabel(app.currentStatus, app.lifecycleStage)
        : (app.detail?.title ?? null)
      const entry = await toRecentApp(app, openedAt, statusLabel)
      const isForeignOwned = user.isPlatformAdmin && app.ownerUserId !== user.ownerUserId
      return {
        ...entry,
        ownerDisplayName: isForeignOwned ? (getOwnerDisplayName(ownerNames, app.ownerUserId) ?? 'Unknown owner') : null,
        canStart: !isForeignOwned && hasPermission(user.permissions, 'applications:start'),
        canStop: app.ownerUserId === user.ownerUserId && hasPermission(user.permissions, 'applications:stop'),
        canClone: isForeignOwned && hasPermission(user.permissions, 'applications:create')
      }
    })
  )
}

export const listVisibleRecentApps = () => listVisibleApps(false)

export const listRecentlyOpenedApps = () => listVisibleApps(true)
