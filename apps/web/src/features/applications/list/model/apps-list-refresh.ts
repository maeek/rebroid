import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type AppsListRefreshOverride = {
  app: AppDefinition
  expiresAt: number | null
}

type MergeAppsListRefreshInput = {
  currentApps: AppDefinition[]
  refreshedApps: AppDefinition[]
  hiddenRemovingIds: ReadonlySet<string>
  pendingOverrides: ReadonlyMap<string, AppsListRefreshOverride>
  nowMs: number
}

export const mergeAppsListRefresh = ({
  currentApps,
  refreshedApps,
  hiddenRemovingIds,
  pendingOverrides,
  nowMs
}: MergeAppsListRefreshInput) => {
  const currentIcons = new Map(currentApps.map(app => [app.id, app.icon]))
  const currentOwnerNames = new Map(currentApps.map(app => [app.id, app.ownerDisplayName]))
  const expiredOverrideIds: string[] = []

  const apps = refreshedApps
    .filter(app => !hiddenRemovingIds.has(app.id))
    .map(app => {
      const nextApp = {
        ...app,
        icon: currentIcons.get(app.id) ?? app.icon,
        ownerDisplayName: currentOwnerNames.get(app.id) ?? app.ownerDisplayName
      }
      const override = pendingOverrides.get(nextApp.id)

      if (!override) {
        return nextApp
      }

      if (override.expiresAt !== null && override.expiresAt <= nowMs) {
        expiredOverrideIds.push(nextApp.id)
        return nextApp
      }

      return override.app
    })

  return { apps, expiredOverrideIds }
}
