'use server'

import { getStoredAppIcon } from '@/server/app-icons/store'
import { getCurrentUserContext } from '../../../current-user'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import type { RunningApplicationNotifications } from '../../types'

export const listApplicationsAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const apps = await orchestratorAppCatalogClient.listApplications(ownerUserId)
  return apps.map(app => sanitizeAndroidApplicationForUser(app, user))
}

export const reconcileApplicationsRuntimeStateAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const results = await orchestratorAppCatalogClient.reconcileApplications(ownerUserId)
  return results.map(result => ({
    ...result,
    application: sanitizeAndroidApplicationForUser(result.application, user)
  }))
}

export const listRunningApplicationNotificationsAction = async (): Promise<RunningApplicationNotifications[]> => {
  const user = await getCurrentUserContext()

  if (!user.ownerUserId) {
    return []
  }

  const apps = await orchestratorAppCatalogClient.listApplicationSummaries(user.ownerUserId)
  const runningApps = apps.filter(app => app.ownerUserId === user.ownerUserId && app.currentStatus === 'running')

  const notifications = await Promise.all(
    runningApps.map(async app => ({
      appId: app.id,
      appName: app.name,
      appIcon: await getStoredAppIcon(app.id),
      appPackageName: app.apkPackageName,
      notifications: await orchestratorAppRuntimeClient.getNotifications(app.id).catch(() => [])
    }))
  )

  return notifications
    .filter(app => app.notifications.length > 0)
    .sort(
      (left, right) =>
        right.notifications.length - left.notifications.length || left.appName.localeCompare(right.appName)
    )
}
