'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService, type UserEditorInput } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const updateUserAction = async (id: string, input: UserEditorInput) => {
  const admin = await requireAdminUser()
  const user = await userService.updateUser(id, input)
  recordAuditEvent(admin.id, 'user.update', user.id)
  revalidateUsersPage()
  return user
}
