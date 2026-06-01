'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserGroupAction = async (input: { name: string; description?: string }) => {
  const admin = await requireAdminUser()
  const group = await userService.createGroup(input)
  recordAuditEvent(admin.id, 'group.create', group.id, { name: group.name })
  revalidateUsersPage()
  return group
}
