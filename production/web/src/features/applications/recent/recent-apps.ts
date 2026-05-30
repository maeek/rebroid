import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { RecentApp } from '@/server/recent-apps/actions'

export const recentAppsUpdatedEvent = 'rebroid-recent-apps-updated'

export const notifyRecentAppsUpdated = (apps?: RecentApp[]): void => {
  window.dispatchEvent(new CustomEvent(recentAppsUpdatedEvent, { detail: apps }))
}

export const rememberRecentApp = (app: AppDefinition): void => {
  notifyRecentAppsUpdated([{ id: app.id, name: app.name, icon: app.icon, openedAt: Date.now() }])
}

export const forgetRecentApp = (appId: string): void => {
  notifyRecentAppsUpdated([{ id: appId, name: '', icon: null, openedAt: 0 }])
}

export type { RecentApp }
