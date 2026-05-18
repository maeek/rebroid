'use server'

import { userService, type UserEditorInput } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const updateUserAction = async (id: string, input: UserEditorInput) => {
  await requireAdminUser()
  const user = await userService.updateUser(id, input)
  revalidateUsersPage()
  return user
}
