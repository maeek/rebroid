import 'server-only'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { navigationAppsLimit, selectNavigationAppEntries } from './navigation'
import { listStoredRecentApps } from './store'
import type { AndroidApplicationSummary } from '@/shared/contracts/application'
import type { RecentApp } from '@/shared/contracts/recent-app'

const toRecentApp = async (app: AndroidApplicationSummary, openedAt: number): Promise<RecentApp> => ({
  id: app.id,
  name: app.name,
  icon: await getStoredAppIcon(app.id),
  openedAt,
  status: app.currentStatus,
  statusLabel: app.detail?.title ?? null
})

export const listVisibleRecentApps = async (): Promise<RecentApp[]> => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const recent = listStoredRecentApps(user.ownerUserId)
  const apps = await orchestratorAppCatalogClient.listApplicationSummaries(ownerUserId)
  const navigationApps = selectNavigationAppEntries(apps, recent, navigationAppsLimit)

  return Promise.all(navigationApps.map(item => toRecentApp(item.app, item.openedAt)))
}
