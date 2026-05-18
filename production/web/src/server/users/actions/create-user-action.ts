'use server'

import { userService, type UserEditorInput } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserAction = async (input: UserEditorInput & { username: string; password: string }) => {
  await requireAdminUser()
  const user = await userService.createUser(input)
  revalidateUsersPage()
  return user
}
