'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const resetUserPasswordAction = async (id: string, password: string) => {
  const admin = await requireAdminUser()
  const user = await userService.resetPassword(id, password)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'user',
    action: 'user.password.reset',
    resourceType: 'user',
    resourceId: user.id,
    resourceLabel: user.name || user.username
  })
  revalidateUsersPage()
  return user
}
