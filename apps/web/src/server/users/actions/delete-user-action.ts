'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'
import { commitWithViewerRevocation } from '../viewer-revocation-mutation'

export const deleteUserAction = async (id: string) =>
  runSafeAction(
    async requestId => {
      const admin = await requireAdminUser()
      const { value: user, viewerRevocation } = await commitWithViewerRevocation(requestId, prepare =>
        userService.deleteUser(id, prepare)
      )
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'user',
        action: 'user.delete',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.name || user.username,
        details: { username: user.username, viewerRevocation }
      })
      revalidateUsersPage()
      return user
    },
    { fallbackMessage: 'Could not delete user.', logLabel: 'deleteUserAction failed' }
  )
