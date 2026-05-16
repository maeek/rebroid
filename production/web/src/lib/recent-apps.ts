import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

export type RecentApp = {
  id: string
  name: string
  icon?: string | null
  openedAt: number
}

export const recentAppsStorageKey = 'sma_recent_apps'
export const recentAppsUpdatedEvent = 'sma-recent-apps-updated'

const writeRecentApps = (apps: RecentApp[]) => {
  window.localStorage.setItem(recentAppsStorageKey, JSON.stringify(apps))
  window.dispatchEvent(new CustomEvent(recentAppsUpdatedEvent, { detail: apps }))
}

export const readRecentApps = () => {
  try {
    const raw = window.localStorage.getItem(recentAppsStorageKey)
    return raw ? (JSON.parse(raw) as RecentApp[]) : []
  } catch {
    return []
  }
}

export const rememberRecentApp = (app: AppDefinition) => {
  const nextApps = [
    { id: app.id, name: app.name, icon: app.icon, openedAt: Date.now() },
    ...readRecentApps().filter(item => item.id !== app.id)
  ].slice(0, 3)

  writeRecentApps(nextApps)
}

export const forgetRecentApp = (appId: string) => {
  const nextApps = readRecentApps().filter(item => item.id !== appId)
  writeRecentApps(nextApps)
}
