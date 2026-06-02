'use server'

import { cloneStoredAppIcon } from '@/server/app-icons/store'
import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorApplicationsClient } from '../../client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import { assertCanAccessApplication, assertCanOpenApplicationSlot } from '../common/action-helpers'

export const cloneApplicationForCurrentUserAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:create')) {
    throw new Error('You do not have permission to create applications.')
  }

  await assertCanOpenApplicationSlot(user)
  const app = await orchestratorApplicationsClient.cloneApplication(id, {
    ownerUserId: user.ownerUserId
  })
  await cloneStoredAppIcon(id, app.id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.clone',
    resourceType: 'application',
    resourceId: app.id,
    resourceLabel: app.name,
    details: { sourceApplicationId: id }
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  revalidateApplicationDetail(app.id)
  return sanitizeAndroidApplicationForUser(app, user)
}
