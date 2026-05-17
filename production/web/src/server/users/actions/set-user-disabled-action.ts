'use server'

import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const setUserDisabledAction = async (id: string, disabled: boolean) => {
  await requireAdminUser()
  const user = await userService.setUserDisabled(id, disabled)
  revalidateUsersPage()
  return user
}
