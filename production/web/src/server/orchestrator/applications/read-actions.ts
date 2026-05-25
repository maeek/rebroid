'use server'

import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../current-user'
import { orchestratorApplicationsClient } from './client'
import { sanitizeAndroidApplicationForUser } from './safety'
import type { RunningApplicationNotifications, ApplicationRuntimeFilesProfileInput } from './types'

export const listApplicationsAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const apps = await orchestratorApplicationsClient.listApplications(ownerUserId)
  return apps.map(app => sanitizeAndroidApplicationForUser(app, user))
}

export const getApplicationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(id)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }
  return sanitizeAndroidApplicationForUser(app, user)
}

const assertCanUseOwnedApplicationRuntime = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(id)
  if (app.ownerUserId !== user.ownerUserId) {
    throw new Error('Open this app as your own copy before using its live session.')
  }
  return { app, user }
}

export const getAndroidNotificationsAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id)
  return orchestratorApplicationsClient.getNotifications(id)
}

export const listRunningApplicationNotificationsAction = async (): Promise<RunningApplicationNotifications[]> => {
  const user = await getCurrentUserContext()

  if (!user.ownerUserId) {
    return []
  }

  const apps = await orchestratorApplicationsClient.listApplications(user.ownerUserId)
  const runningApps = apps.filter(app => app.ownerUserId === user.ownerUserId && app.status.currentStatus === 'running')

  const notifications = await Promise.all(
    runningApps.map(async app => ({
      appId: app.id,
      appName: app.name,
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

export const getApplicationLogsAction = async (
  id: string,
  source: 'orchestrator' | 'container' | 'adb',
  tail = 300
) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:view-logs')) {
    throw new Error('You do not have permission to view logs.')
  }
  return orchestratorApplicationsClient.getApplicationLogs(id, source, tail)
}

export const listApplicationDownloadFilesAction = async (id: string, profile?: ApplicationRuntimeFilesProfileInput) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  return orchestratorApplicationsClient.listDownloadFiles(id, profile)
}

export const downloadApplicationFileAction = async (
  id: string,
  fileName: string,
  profile?: ApplicationRuntimeFilesProfileInput
) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  return orchestratorApplicationsClient.downloadFile(id, fileName, profile)
}

export const getApplicationClipboardAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new Error('You do not have permission to sync clipboard.')
  }
  return orchestratorApplicationsClient.getClipboard(id)
}

export const captureApplicationScreenshotAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:capture-screenshot')) {
    throw new Error('You do not have permission to capture screenshots.')
  }
  return orchestratorApplicationsClient.captureScreenshot(id)
}

export const getScrcpySessionAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id)
  return orchestratorApplicationsClient.getScrcpySession(id)
}

export const recordViewerActivityAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id)
  return orchestratorApplicationsClient.recordViewerActivity(id)
}

export const filterAccessibleApplicationIdsAction = async (ids: string[]) => {
  if (ids.length === 0) {
    return []
  }

  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const apps = await orchestratorApplicationsClient.listApplications(ownerUserId)
  const accessibleIds = new Set(apps.map(app => app.id))

  return ids.filter(id => accessibleIds.has(id))
}
