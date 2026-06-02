'use server'

import { getStoredAppIcon } from '@/server/app-icons/store'
import { getCurrentUserContext } from '../../../current-user'
import { orchestratorApplicationsClient } from '../../client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import type { RunningApplicationNotifications } from '../../types'

export const listApplicationsAction = async ({ reconcile = false }: { reconcile?: boolean } = {}) => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const apps = await orchestratorApplicationsClient.listApplications(ownerUserId, reconcile)
  return apps.map(app => sanitizeAndroidApplicationForUser(app, user))
}

export const listRunningApplicationNotificationsAction = async (): Promise<RunningApplicationNotifications[]> => {
  const user = await getCurrentUserContext()

  if (!user.ownerUserId) {
    return []
  }

  const apps = await orchestratorApplicationsClient.listApplicationSummaries(user.ownerUserId)
  const runningApps = apps.filter(app => app.ownerUserId === user.ownerUserId && app.currentStatus === 'running')

  const notifications = await Promise.all(
    runningApps.map(async app => ({
      appId: app.id,
      appName: app.name,
      appIcon: await getStoredAppIcon(app.id),
      appPackageName: app.apkPackageName,
      notifications: await orchestratorApplicationsClient.getNotifications(app.id).catch(() => [])
    }))
  )

  return notifications
    .filter(app => app.notifications.length > 0)
    .sort(
      (left, right) =>
        right.notifications.length - left.notifications.length || left.appName.localeCompare(right.appName)
    )
}
