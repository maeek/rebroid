import 'server-only'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { compareAppNames } from '@/shared/model/applications/app-sort'
import { getAppStatusLabel } from '@/shared/model/applications/app-status-label'
import { externalDeviceHref, externalDeviceStatusLabel } from '@/shared/model/applications/external-device-links'
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

  const entries = await Promise.all(
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
  const managedIds = new Set(apps.map(app => app.id))
  const externalVisits = recent.filter(entry => !managedIds.has(entry.id) && !dismissedIds?.has(entry.id))
  if (
    !externalVisits.length ||
    !process.env.EXTERNAL_ADB_BROKER_SECRET ||
    (!hasPermission(user.permissions, 'devices:use-external') &&
      !hasPermission(user.permissions, 'devices:enroll-external'))
  ) {
    return entries
  }
  const flags = await loadFeatureFlags()
  if (!flags?.features.some(flag => flag.key === 'feature.external-devices' && flag.effective)) return entries

  const external = await externalDeviceClient
    .list({ userId: user.ownerUserId, administrator: user.isPlatformAdmin })
    .catch(() => [])
  const externalById = new Map(external.map(device => [device.id, device]))
  const externalEntries = externalVisits.flatMap(({ id, openedAt }): RecentApp[] => {
    const device = externalById.get(id)
    if (!device) return []
    return [
      {
        id,
        name: device.name,
        openedAt,
        href: externalDeviceHref(id),
        connectionHref: externalDeviceHref(id, 'connection'),
        statusLabel: externalDeviceStatusLabel[device.connection.state],
        kindLabel: device.transport === 'usb' ? 'External USB' : 'External TCP'
      }
    ]
  })
  const combined = [...entries, ...externalEntries]
  return (
    recentOnly
      ? combined.toSorted((left, right) => right.openedAt - left.openedAt)
      : combined.toSorted(
          (left, right) =>
            Number(right.status === 'running') - Number(left.status === 'running') || compareAppNames(left, right)
        )
  ).slice(0, navigationAppsLimit)
}

export const listVisibleRecentApps = () => listVisibleApps(false)

export const listRecentlyOpenedApps = () => listVisibleApps(true)
