'use server'

import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../current-user'
import { orchestratorApplicationsClient } from './client'
import { sanitizeAndroidApplicationForUser } from './safety'

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

const assertCanAccessApplication = async (id: string) => {
  await getApplicationAction(id)
}

export const getAndroidNotificationsAction = async (id: string) => {
  await assertCanAccessApplication(id)
  return orchestratorApplicationsClient.getNotifications(id)
}

export const getApplicationLogsAction = async (id: string, source: 'container' | 'adb', tail = 300) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:view-logs')) {
    throw new Error('You do not have permission to view logs.')
  }
  return orchestratorApplicationsClient.getApplicationLogs(id, source, tail)
}

export const getScrcpySessionAction = async (id: string) => {
  await assertCanAccessApplication(id)
  return orchestratorApplicationsClient.getScrcpySession(id)
}

export const recordViewerActivityAction = async (id: string) => {
  await assertCanAccessApplication(id)
  return orchestratorApplicationsClient.recordViewerActivity(id)
}
