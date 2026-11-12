'use server'

import { getStoredAppIcon } from '@/server/app-icons/store'
import { getCurrentUserContext } from '../../../current-user'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import type { RunningApplicationNotifications } from '@/shared/contracts/application'

export const listApplicationsAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.isPlatformAdmin ? undefined : user.ownerUserId
  const apps = await orchestratorAppCatalogClient.listApplications(ownerUserId)
  return apps.map(app => sanitizeAndroidApplicationForUser(app, user))
}

export const listRunningApplicationNotificationsAction = async (): Promise<RunningApplicationNotifications[]> => {
  const user = await getCurrentUserContext()

  if (!user.ownerUserId) {
    return []
  }

  const apps = await orchestratorAppCatalogClient.listApplicationSummaries(user.ownerUserId, { includeRunning: true })
  const runningApps = apps.filter(app => app.ownerUserId === user.ownerUserId && app.currentStatus === 'running')

  const perAppNotifications = await Promise.all(
    runningApps.map(async app => {
      const notifications = await orchestratorAppRuntimeClient.getNotifications(app.id).catch(() => [])
      if (!notifications.length) return null
      return {
        appId: app.id,
        appName: app.name,
        appIcon: await getStoredAppIcon(app.id),
        appPackageName: app.apkPackageName,
        notifications
      }
    })
  )

  return perAppNotifications
    .filter(app => app !== null)
    .sort(
      (left, right) =>
        right.notifications.length - left.notifications.length || left.appName.localeCompare(right.appName)
    )
}
