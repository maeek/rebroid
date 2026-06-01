'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const setUserDisabledAction = async (id: string, disabled: boolean) => {
  const admin = await requireAdminUser()
  const user = await userService.setUserDisabled(id, disabled)
  recordAuditEvent(admin.id, disabled ? 'user.disable' : 'user.enable', user.id)
  revalidateUsersPage()
  return user
}
