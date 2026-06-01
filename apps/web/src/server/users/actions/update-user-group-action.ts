'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService, type UserGroup } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'
import type { ResourceQuota } from '@/shared/permissions/permissions'

export const updateUserGroupAction = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  }
) => {
  const admin = await requireAdminUser()
  const group = await userService.updateGroup(id, input)
  recordAuditEvent(admin.id, 'group.update', group.id, { name: group.name })
  revalidateUsersPage()
  return group
}
