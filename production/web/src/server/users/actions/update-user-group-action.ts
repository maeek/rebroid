'use server'

import { userService, type UserGroup } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'
import type { ResourceQuota } from '@/shared/permissions/permissions'

export const updateUserGroupAction = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  }
) => {
  await requireAdminUser()
  const group = await userService.updateGroup(id, input)
  revalidateUsersPage()
  return group
}
