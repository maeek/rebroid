'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { runSafeAction } from '@/server/actions/safe-action'
import { userService, type UserGroup } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'
import type { ResourceQuota } from '@/shared/permissions/permissions'

export const updateUserGroupAction = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  }
) => {
  return runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const group = await userService.updateGroup(id, input)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'group',
        action: 'group.update',
        resourceType: 'group',
        resourceId: group.id,
        resourceLabel: group.name,
        details: { name: group.name }
      })
      revalidateUsersPage()
      return group
    },
    { fallbackMessage: 'Could not update group.', logLabel: 'updateUserGroupAction failed' }
  )
}
