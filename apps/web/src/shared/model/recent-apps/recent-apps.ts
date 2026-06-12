import type { RecentApp } from '@/server/recent-apps/actions'

export const recentAppsUpdatedEvent = 'rebroid-recent-apps-updated'

export const notifyRecentAppsUpdated = (apps?: RecentApp[]): void => {
  window.dispatchEvent(new CustomEvent(recentAppsUpdatedEvent, { detail: apps }))
}

export type { RecentApp }
