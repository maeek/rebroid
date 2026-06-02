'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService, type UserEditorInput } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const updateUserAction = async (id: string, input: UserEditorInput) => {
  const admin = await requireAdminUser()
  const user = await userService.updateUser(id, input)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'user',
    action: 'user.update',
    resourceType: 'user',
    resourceId: user.id,
    resourceLabel: user.name || user.username
  })
  revalidateUsersPage()
  return user
}
