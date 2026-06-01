'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserAction = async (id: string) => {
  const admin = await requireAdminUser()
  const user = await userService.deleteUser(id)
  recordAuditEvent(admin.id, 'user.delete', user.id, { username: user.username })
  revalidateUsersPage()
  return user
}
