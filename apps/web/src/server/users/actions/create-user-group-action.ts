'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { runSafeAction } from '@/server/actions/safe-action'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserGroupAction = async (input: { name: string; description?: string }) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const group = await userService.createGroup(input)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'group',
        action: 'group.create',
        resourceType: 'group',
        resourceId: group.id,
        resourceLabel: group.name,
        details: { name: group.name }
      })
      revalidateUsersPage()
      return group
    },
    { fallbackMessage: 'Could not create group.', logLabel: 'createUserGroupAction failed' }
  )
