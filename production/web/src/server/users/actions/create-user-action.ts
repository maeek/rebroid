'use server'

import { userService, type UserRole } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserAction = async (input: { username: string; password: string; role: UserRole }) => {
  await requireAdminUser()
  const user = await userService.createUser(input)
  revalidateUsersPage()
  return user
}
