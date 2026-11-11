'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserGroupAction = async (id: string) =>
  runSafeAction(
    async requestId => {
      const admin = await requireAdminUser()
      const { value: group, viewerRevocation } = await userService.deleteGroup(id, {
        identity: admin.identity,
        requestId
      })
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'group',
        action: 'group.delete',
        resourceType: 'group',
        resourceId: group.id,
        resourceLabel: group.name,
        details: { name: group.name, viewerRevocation }
      })
      revalidateUsersPage()
      return group
    },
    { fallbackMessage: 'Could not delete group.', logLabel: 'deleteUserGroupAction failed' }
  )
