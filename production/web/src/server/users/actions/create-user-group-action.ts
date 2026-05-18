'use server'

import { userService } from '@/server/auth/user'
import { requireAdminUser, revalidateUsersPage } from '../shared'

export const createUserGroupAction = async (input: { name: string; description?: string }) => {
  await requireAdminUser()
  const group = await userService.createGroup(input)
  revalidateUsersPage()
  return group
}
