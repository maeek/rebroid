'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserGroupAction = async (input: { name: string; description?: string }) => {
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
}
