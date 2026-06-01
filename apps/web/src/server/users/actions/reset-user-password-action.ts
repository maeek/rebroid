'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const resetUserPasswordAction = async (id: string, password: string) => {
  const admin = await requireAdminUser()
  const user = await userService.resetPassword(id, password)
  recordAuditEvent(admin.id, 'user.password.reset', user.id)
  revalidateUsersPage()
  return user
}
