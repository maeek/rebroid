'use server'

import { getCurrentUserContext } from '../current-user'
import { orchestratorApplicationsClient } from './client'

export const listApplicationsAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  return orchestratorApplicationsClient.listApplications(ownerUserId)
}

export const getApplicationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(id)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }
  return app
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
