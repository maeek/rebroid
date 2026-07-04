'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { runSafeAction } from '@/server/actions/safe-action'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserAction = async (id: string) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const user = await userService.deleteUser(id)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'user',
        action: 'user.delete',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.name || user.username,
        details: { username: user.username }
      })
      revalidateUsersPage()
      return user
    },
    { fallbackMessage: 'Could not delete user.', logLabel: 'deleteUserAction failed' }
  )
