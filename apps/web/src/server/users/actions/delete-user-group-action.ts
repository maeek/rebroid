'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { revokeGroupViewerSessions, revokeUserViewerSessions } from '../revoke-viewer-sessions'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserGroupAction = async (id: string) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const affectedIds = await revokeGroupViewerSessions(id)
      const group = await userService.deleteGroup(id)
      for (const userId of affectedIds) await revokeUserViewerSessions(userId)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'group',
        action: 'group.delete',
        resourceType: 'group',
        resourceId: group.id,
        resourceLabel: group.name,
        details: { name: group.name }
      })
      revalidateUsersPage()
      return group
    },
    { fallbackMessage: 'Could not delete group.', logLabel: 'deleteUserGroupAction failed' }
  )
