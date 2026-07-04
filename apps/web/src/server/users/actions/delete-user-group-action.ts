'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { runSafeAction } from '@/server/actions/safe-action'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserGroupAction = async (id: string) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const group = await userService.deleteGroup(id)
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
