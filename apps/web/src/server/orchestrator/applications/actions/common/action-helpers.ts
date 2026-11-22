import { PublicActionError } from '@/server/errors/public-action-error'
import { getCurrentUserContext } from '../../../current-user'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'

export type CurrentUserContext = Awaited<ReturnType<typeof getCurrentUserContext>>

export const getAccessibleApplication = async (id: string, response?: 'api') => {
  const user = await getCurrentUserContext(response)
  const app = await orchestratorAppCatalogClient.getApplication(id)
  if (!user.isPlatformAdmin && app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }
  return { app, user }
}

export const getSanitizedAccessibleApplication = async (id: string, response?: 'api') => {
  const { app, user } = await getAccessibleApplication(id, response)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const assertCanUseOwnedApplicationRuntime = async (id: string, message: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorAppCatalogClient.getApplication(id)
  if (app.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError(message, { code: 'forbidden', status: 403 })
  }
  return { app, user }
}

export const requireOwnedRuntimeContext = async (id: string, message: string, response?: 'api') => {
  const user = await getCurrentUserContext(response)
  const target = await orchestratorAppCatalogClient.getViewerRuntime(id)
  if (target.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError(message, { code: 'forbidden', status: 403 })
  }
  return user
}

export const ownedRuntimeMessage = 'Open this app as your own copy before using its live session.'

export const ownedRuntimeControlMessage =
  'Open this app as your own copy before starting or controlling its live session.'
