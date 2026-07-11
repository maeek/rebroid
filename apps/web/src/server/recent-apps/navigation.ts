import { compareAppNames } from '@/shared/model/applications/app-sort'
import type { AndroidApplicationSummary } from '@/server/orchestrator/applications/types'

export const navigationAppsLimit = 5

type NavigationApp = Pick<AndroidApplicationSummary, 'currentStatus' | 'id' | 'name'>
type StoredRecentApp = {
  id: string
  openedAt: number
}

export const selectNavigationAppEntries = <TApp extends NavigationApp>(
  apps: TApp[],
  recent: StoredRecentApp[],
  limit = navigationAppsLimit
) => {
  const appsById = new Map(apps.map(app => [app.id, app]))
  const runningApps = apps
    .filter(app => app.currentStatus === 'running')
    .toSorted(compareAppNames)
    .slice(0, limit)
  const runningIds = new Set(runningApps.map(app => app.id))
  const recentApps = recent
    .slice(0, limit)
    .map(item => {
      const app = appsById.get(item.id)
      return app && !runningIds.has(app.id) ? { app, openedAt: item.openedAt } : null
    })
    .filter((item): item is { app: TApp; openedAt: number } => Boolean(item))
    .toSorted((left, right) => compareAppNames(left.app, right.app))
    .slice(0, Math.max(0, limit - runningApps.length))

  return [
    ...runningApps.map(app => ({ app, openedAt: recent.find(item => item.id === app.id)?.openedAt ?? 0 })),
    ...recentApps
  ]
}
