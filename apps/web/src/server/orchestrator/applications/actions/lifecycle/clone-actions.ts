'use server'

import { cloneStoredAppIcon } from '@/server/app-icons/store'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { isTrustedRedroidImage } from '../../image-access'
import { enforceResourceQuotas, enforceSessionQuota, sanitizeAndroidApplicationForUser } from '../../safety'
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

  const source = await orchestratorAppCatalogClient.getApplication(id)
  const imagePermission = isTrustedRedroidImage(source.runtime.image)
    ? 'applications:use-redroid-images'
    : 'applications:use-custom-images'
  if (user.role !== 'admin' && !hasPermission(user.permissions, imagePermission)) {
    throw new PublicActionError('You do not have permission to use this image.', { code: 'forbidden', status: 403 })
  }
  enforceResourceQuotas(source.runtime.resources, user.quotas)
  enforceSessionQuota({ inactivityTimeoutSeconds: source.runtime.inactivityTimeoutSeconds }, user.quotas)
  await assertCanOpenApplicationSlot(user)
  const command = await orchestratorAppCatalogClient.cloneApplication(
    id,
    {
      ownerUserId: user.ownerUserId
    },
    user.quotas.maxOpenApps
  )
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
