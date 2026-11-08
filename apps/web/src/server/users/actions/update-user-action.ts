'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { revokeUserViewerSessions } from '../revoke-viewer-sessions'
import { requireAdminUser, revalidateUsersPage } from '../shared'
import type { UserEditorInput } from '@/shared/contracts/auth-user'

export const updateUserAction = async (id: string, input: UserEditorInput) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      await revokeUserViewerSessions(id)
      const user = await userService.updateUser(id, input)
      await revokeUserViewerSessions(id)
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
    },
    { fallbackMessage: 'Could not update user.', logLabel: 'updateUserAction failed' }
  )
