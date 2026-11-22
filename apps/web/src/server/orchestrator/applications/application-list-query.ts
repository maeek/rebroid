import 'server-only'

import { getCurrentUserContext } from '../current-user'
import { orchestratorAppCatalogClient } from './catalog-client'
import { sanitizeAndroidApplicationForUser } from './safety'

export const listVisibleApplications = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.isPlatformAdmin ? undefined : user.ownerUserId
  const apps = await orchestratorAppCatalogClient.listApplications(ownerUserId)
  const visible = ownerUserId === undefined ? apps : apps.filter(app => app.ownerUserId === ownerUserId)
  return visible.map(app => sanitizeAndroidApplicationForUser(app, user))
}
