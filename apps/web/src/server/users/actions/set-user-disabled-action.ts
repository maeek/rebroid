'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const setUserDisabledAction = async (id: string, disabled: boolean) => {
  const admin = await requireAdminUser()
  const user = await userService.setUserDisabled(id, disabled)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'user',
    action: disabled ? 'user.disable' : 'user.enable',
    resourceType: 'user',
    resourceId: user.id,
    resourceLabel: user.name || user.username
  })
  revalidateUsersPage()
  return user
}
