'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService, type UserEditorInput } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserAction = async (input: UserEditorInput & { username: string; password: string }) => {
  const admin = await requireAdminUser()
  const user = await userService.createUser(input)
  recordAuditEvent(admin.id, 'user.create', user.id, { username: user.username })
  revalidateUsersPage()
  return user
}
