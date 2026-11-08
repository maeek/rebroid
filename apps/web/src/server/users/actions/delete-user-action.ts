'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { revokeUserViewerSessions } from '../revoke-viewer-sessions'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserAction = async (id: string) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      await revokeUserViewerSessions(id)
      const user = await userService.deleteUser(id)
      await revokeUserViewerSessions(id)
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
