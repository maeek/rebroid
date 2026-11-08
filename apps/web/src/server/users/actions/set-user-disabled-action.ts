'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { revokeUserViewerSessions } from '../revoke-viewer-sessions'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const setUserDisabledAction = async (id: string, disabled: boolean) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      await revokeUserViewerSessions(id)
      const user = await userService.setUserDisabled(id, disabled)
      await revokeUserViewerSessions(id)
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
    },
    { fallbackMessage: 'Could not update user.', logLabel: 'setUserDisabledAction failed' }
  )
