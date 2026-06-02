'use server'

import { getStoredAppIcon } from '@/server/app-icons/store'
import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../current-user'
import { orchestratorApplicationsClient } from './client'
import {
  sanitizeAndroidApplicationForUser,
  sanitizeApplicationLogForUser,
  sanitizeScrcpySessionForUser
} from './safety'
import type { RunningApplicationNotifications, ApplicationRuntimeFilesProfileInput } from './types'

export const listApplicationsAction = async ({ reconcile = false }: { reconcile?: boolean } = {}) => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const apps = await orchestratorApplicationsClient.listApplications(ownerUserId, reconcile)
  return apps.map(app => sanitizeAndroidApplicationForUser(app, user))
}

export const listApplicationSummariesAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  const apps = await orchestratorApplicationsClient.listApplicationSummaries(ownerUserId)
  return apps.filter(app => user.role === 'admin' || app.ownerUserId === user.ownerUserId)
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

export const getOwnedApplicationAction = async (id: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  return sanitizeAndroidApplicationForUser(app, user)
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

export const getApplicationLogsAction = async (
  id: string,
  source: 'orchestrator' | 'container' | 'adb',
  tail = 300
) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:view-logs')) {
    throw new Error('You do not have permission to view logs.')
  }
  const log = await orchestratorApplicationsClient.getApplicationLogs(id, source, tail)
  return sanitizeApplicationLogForUser(log, user)
}

export const listApplicationDownloadFilesAction = async (id: string, profile?: ApplicationRuntimeFilesProfileInput) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  return orchestratorApplicationsClient.listDownloadFiles(id, profile)
}

export const listApplicationFilesAction = async (id: string, path: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  return orchestratorApplicationsClient.listFiles(id, path)
}

export const downloadApplicationRuntimeFileAction = async (id: string, path: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  const result = await orchestratorApplicationsClient.downloadRuntimeFile(id, path)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.file.download',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { path, name: result.name }
  })
  return result
}

export const downloadApplicationFileAction = async (
  id: string,
  fileName: string,
  profile?: ApplicationRuntimeFilesProfileInput
) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  const result = await orchestratorApplicationsClient.downloadFile(id, fileName, profile)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.file.download',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { fileName, profileMode: profile?.profileMode, profileName: profile?.profileName }
  })
  return result
}

export const getApplicationClipboardAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new Error('You do not have permission to sync clipboard.')
  }
  return orchestratorApplicationsClient.getClipboard(id)
}

export const captureApplicationScreenshotAction = async (id: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:capture-screenshot')) {
    throw new Error('You do not have permission to capture screenshots.')
  }
  const result = await orchestratorApplicationsClient.captureScreenshot(id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.screenshot.capture',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name
  })
  return result
}

export const getScrcpySessionAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  const session = await orchestratorApplicationsClient.getScrcpySession(id, {
    control: user.role === 'admin' || hasPermission(user.permissions, 'applications:control-viewer'),
    clipboard: user.role === 'admin' || hasPermission(user.permissions, 'applications:sync-clipboard')
  })
  return sanitizeScrcpySessionForUser(session, user)
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
  const apps = await orchestratorApplicationsClient.listApplicationSummaries(ownerUserId)
  const accessibleIds = new Set(apps.map(app => app.id))

  return ids.filter(id => accessibleIds.has(id))
}
