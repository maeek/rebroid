'use server'

import { PublicActionError } from '@/server/errors/public-action-error'

import { cloneStoredAppIcon } from '@/server/app-icons/store'
import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import { assertCanAccessApplication, assertCanOpenApplicationSlot } from '../common/action-helpers'

export const cloneApplicationForCurrentUserAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:create')) {
    throw new PublicActionError('You do not have permission to create applications.', {
      code: 'forbidden',
      status: 403
    })
  }

  await assertCanOpenApplicationSlot(user)
  const command = await orchestratorAppCatalogClient.cloneApplication(id, {
    ownerUserId: user.ownerUserId
  })
  await cloneStoredAppIcon(id, command.id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.clone',
    resourceType: 'application',
    resourceId: command.id,
    resourceLabel: command.name,
    details: { sourceApplicationId: id }
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  const app = await orchestratorAppCatalogClient.getApplication(command.id)
  revalidateApplicationDetail(app.id)
  return sanitizeAndroidApplicationForUser(app, user)
}
