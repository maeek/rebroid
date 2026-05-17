'use server'

import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const deleteUserAction = async (id: string) => {
  await requireAdminUser()
  const user = await userService.deleteUser(id)
  revalidateUsersPage()
  return user
}
