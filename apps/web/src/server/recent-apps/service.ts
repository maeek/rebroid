import 'server-only'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { getAppStatusLabel } from '@/shared/model/applications/app-status-label'
import { navigationAppsLimit } from '@/shared/model/recent-apps/recent-apps'
import { hasPermission } from '@/shared/permissions/permissions'
import { selectNavigationAppEntries, selectRecentlyOpenedAppEntries } from './navigation'
import { listDismissedRecentAppIds, listStoredRecentApps } from './store'
import type { RecentApp } from '@/shared/contracts/recent-app'

const toRecentApp = async (
  app: Pick<RecentApp, 'id' | 'name'> & { currentStatus: RecentApp['status'] },
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
  // Large dismissal histories fall back to the same narrow projection and local selection.
  const canExcludeUpstream = dismissedIds !== undefined && dismissedIds.size <= 512
  const apps = await orchestratorAppCatalogClient.listApplicationNavigation({
    ...(ownerUserId && { ownerUserId }),
    applicationIds: recent.map(app => app.id),
    includeRunning: !recentOnly,
    ...(canExcludeUpstream && {
      excludeIds: [...dismissedIds],
      runningLimit: navigationAppsLimit,
      locale: Intl.Collator().resolvedOptions().locale
    })
  })
  const navigationApps = recentOnly
    ? selectRecentlyOpenedAppEntries(apps, recent)
    : selectNavigationAppEntries(
        apps.filter(app => !dismissedIds?.has(app.id)),
        recent
      )
  const otherOwnerIds = new Set<string>()
  for (const { app } of navigationApps) {
    if (app.ownerUserId && app.ownerUserId !== user.ownerUserId) otherOwnerIds.add(app.ownerUserId)
  }
  const ownerNames = await getVisibleOwnerDisplayNames(user, [...otherOwnerIds])

  return Promise.all(
    navigationApps.map(async ({ app, openedAt }) => {
      const statusLabel = getAppStatusLabel(app.currentStatus, app.lifecycleStage)
      const entry = await toRecentApp(app, openedAt, statusLabel)
      const isForeignOwned = user.isPlatformAdmin && app.ownerUserId !== user.ownerUserId
      return {
        ...entry,
        ownerDisplayName: isForeignOwned ? (getOwnerDisplayName(ownerNames, app.ownerUserId) ?? 'Unknown owner') : null,
        canStart: !isForeignOwned && hasPermission(user.permissions, 'applications:start'),
        canStop: app.ownerUserId === user.ownerUserId && hasPermission(user.permissions, 'applications:stop'),
        canClone: isForeignOwned && hasPermission(user.permissions, 'applications:create'),
        canViewSnapshot:
          app.ownerUserId === user.ownerUserId && hasPermission(user.permissions, 'applications:capture-screenshot')
      }
    })
  )
}

export const listVisibleRecentApps = () => listVisibleApps(false)

export const listRecentlyOpenedApps = () => listVisibleApps(true)
