'use server'

import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const resetUserPasswordAction = async (id: string, password: string) => {
  await requireAdminUser()
  const user = await userService.resetPassword(id, password)
  revalidateUsersPage()
  return user
}
