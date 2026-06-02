import { getCurrentUserContext } from '../../../current-user'
import { orchestratorApplicationsClient } from '../../client'
import { sanitizeAndroidApplicationForUser } from '../../safety'

export type CurrentUserContext = Awaited<ReturnType<typeof getCurrentUserContext>>

const getAccessibleApplication = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(id)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }
  return { app, user }
}

export const getSanitizedAccessibleApplication = async (id: string) => {
  const { app, user } = await getAccessibleApplication(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const assertCanAccessApplication = async (id: string) => {
  await getAccessibleApplication(id)
}

export const assertCanUseOwnedApplicationRuntime = async (id: string, message: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(id)
  if (app.ownerUserId !== user.ownerUserId) {
    throw new Error(message)
  }
  return { app, user }
}

export const assertCanOpenApplicationSlot = async (user: CurrentUserContext, candidateId?: string) => {
  if (user.quotas.maxOpenApps === null) {
    return
  }

  const apps = await orchestratorApplicationsClient.listApplications(user.ownerUserId)
  const openApps = apps.filter(app => ['running', 'provisioning'].includes(app.status.currentStatus))
  const candidateIsAlreadyOpen = candidateId ? openApps.some(app => app.id === candidateId) : false

  if (!candidateIsAlreadyOpen && openApps.length >= user.quotas.maxOpenApps) {
    throw new Error(
      `Open app limit reached (${openApps.length}/${user.quotas.maxOpenApps}). Stop an app before starting another.`
    )
  }
}

export const ownedRuntimeMessage = 'Open this app as your own copy before using its live session.'

export const ownedRuntimeControlMessage =
  'Open this app as your own copy before starting or controlling its live session.'
