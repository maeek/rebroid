'use server'

import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { forgetStoredRecentApp, listStoredRecentApps, rememberStoredRecentApp } from './store'

export type RecentApp = {
  id: string
  name: string
  icon?: string | null
  openedAt: number
}

const visibleRecentApps = async (userId: string): Promise<RecentApp[]> => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const [recent, apps] = await Promise.all([
    listStoredRecentApps(userId),
    orchestratorApplicationsClient.listApplications(ownerUserId)
  ])
  const appsById = new Map(apps.map(app => [app.id, app]))

  const hydratedApps: Array<RecentApp | null> = await Promise.all(
    recent.map(async item => {
      const app = appsById.get(item.id)
      if (!app) {
        return null
      }

      return {
        id: app.id,
        name: app.name,
        icon: await getStoredAppIcon(app.id),
        openedAt: item.openedAt
      }
    })
  )

  return hydratedApps.filter((app): app is RecentApp => Boolean(app))
}

export const listRecentAppsAction = async () => {
  const user = await getCurrentUserContext()
  return visibleRecentApps(user.ownerUserId)
}

export const rememberRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(appId)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }

  await rememberStoredRecentApp(user.ownerUserId, appId)
  return visibleRecentApps(user.ownerUserId)
}

export const forgetRecentAppAction = async (appId: string) => {
  const user = await getCurrentUserContext()
  await forgetStoredRecentApp(user.ownerUserId, appId)
  return visibleRecentApps(user.ownerUserId)
}
