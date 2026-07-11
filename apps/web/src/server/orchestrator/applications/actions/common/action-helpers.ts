import { PublicActionError } from '@/server/errors/public-action-error'
import { getCurrentUserContext } from '../../../current-user'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'

export type CurrentUserContext = Awaited<ReturnType<typeof getCurrentUserContext>>

const getAccessibleApplication = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorAppCatalogClient.getApplication(id)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
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
  const app = await orchestratorAppCatalogClient.getApplication(id)
  if (app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError(message, { code: 'forbidden', status: 403 })
  }
  return { app, user }
}

export const assertCanOpenApplicationSlot = async (user: CurrentUserContext, candidateId?: string) => {
  if (user.quotas.maxOpenApps === null) {
    return
  }

  const apps = await orchestratorAppCatalogClient.listApplications(user.ownerUserId)
  const openApps = apps.filter(app => ['running', 'provisioning'].includes(app.status.currentStatus))
  const candidateIsAlreadyOpen = candidateId ? openApps.some(app => app.id === candidateId) : false

  if (!candidateIsAlreadyOpen && openApps.length >= user.quotas.maxOpenApps) {
    throw new PublicActionError(
      `Open app limit reached (${openApps.length}/${user.quotas.maxOpenApps}). Stop an app before starting another.`,
      { code: 'conflict', status: 409 }
    )
  }
}

export const ownedRuntimeMessage = 'Open this app as your own copy before using its live session.'

export const ownedRuntimeControlMessage =
  'Open this app as your own copy before starting or controlling its live session.'
