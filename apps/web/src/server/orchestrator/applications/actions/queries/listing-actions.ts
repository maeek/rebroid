'use server'

import { getCurrentUserContext } from '../../../current-user'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'

export const listApplicationsAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.isPlatformAdmin ? undefined : user.ownerUserId
  const apps = await orchestratorAppCatalogClient.listApplications(ownerUserId)
  return apps.map(app => sanitizeAndroidApplicationForUser(app, user))
}
