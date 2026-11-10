import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type AppsListRefreshOverride = {
  app: AppDefinition
  expiresAt: number | null
  acknowledgedAfter?: number
}

type MergeAppsListRefreshInput = {
  currentApps: AppDefinition[]
  refreshedApps: AppDefinition[]
  hiddenRemovingIds: ReadonlySet<string>
  pendingOverrides: ReadonlyMap<string, AppsListRefreshOverride>
  nowMs: number
  useRefreshedPresentation?: boolean
}

export const mergeAppsListRefresh = ({
  currentApps,
  refreshedApps,
  hiddenRemovingIds,
  pendingOverrides,
  nowMs,
  useRefreshedPresentation = false
}: MergeAppsListRefreshInput) => {
  const currentById = new Map(currentApps.map(app => [app.id, app]))
  const expiredOverrideIds: string[] = []

  const apps = refreshedApps
    .filter(app => !hiddenRemovingIds.has(app.id))
    .map(app => {
      const current = currentById.get(app.id)
      if (current && current.updatedAt.getTime() > app.updatedAt.getTime()) return current

      const nextApp = useRefreshedPresentation
        ? app
        : {
            ...app,
            icon: current?.icon ?? app.icon,
            ownerDisplayName: current?.ownerDisplayName ?? app.ownerDisplayName
          }
      const override = pendingOverrides.get(nextApp.id)

      if (!override) {
        return nextApp
      }

      if (
        (override.expiresAt !== null && override.expiresAt <= nowMs) ||
        (override.acknowledgedAfter !== undefined &&
          (nextApp.updatedAt.getTime() > override.acknowledgedAfter ||
            (nextApp.status === override.app.status && nextApp.lifecycleStage === override.app.lifecycleStage)))
      ) {
        expiredOverrideIds.push(nextApp.id)
        return nextApp
      }

      return override.app
    })

  const refreshedIds = new Set(refreshedApps.map(app => app.id))
  for (const [id, override] of pendingOverrides) {
    if (override.acknowledgedAfter !== undefined && !refreshedIds.has(id)) expiredOverrideIds.push(id)
  }

  return { apps, expiredOverrideIds }
}
