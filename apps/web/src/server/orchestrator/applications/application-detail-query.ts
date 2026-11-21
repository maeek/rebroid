import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getCurrentUserContext } from '../current-user'
import { orchestratorAppCatalogClient } from './catalog-client'
import { canViewBackendDetails, sanitizeAndroidApplicationForUser, sanitizeApplicationDetailState } from './safety'

export const refreshApplicationDetail = async (id: string, revision?: string, signal?: AbortSignal) => {
  const user = await getCurrentUserContext('api')
  const [known, visibility] = revision?.split('.') ?? []
  const result = await orchestratorAppCatalogClient.refreshApplicationDetail(
    id,
    visibility === (canViewBackendDetails(user) ? '1' : '0') ? known : undefined,
    signal
  )
  if (!user.isPlatformAdmin && result.ownerUserId !== user.ownerUserId) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }
  return {
    app: result.app && sanitizeAndroidApplicationForUser(result.app, user),
    state: result.state && sanitizeApplicationDetailState(result.state, user)
  }
}
