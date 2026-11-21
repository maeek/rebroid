import type { RecentApp } from '@/shared/contracts/recent-app'

export const navigationAppsLimit = 5

export const recentAppsUpdatedEvent = 'rebroid-recent-apps-updated'

export const notifyRecentAppsUpdated = (apps?: RecentApp[]): void => {
  window.dispatchEvent(new CustomEvent(recentAppsUpdatedEvent, { detail: apps }))
}
