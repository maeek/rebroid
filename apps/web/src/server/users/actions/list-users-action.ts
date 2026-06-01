'use server'

import { userService } from '@/server/auth/user'
import { requireAdminUser } from '../shared'

export const listUsersAction = async () => {
  await requireAdminUser()
  return userService.listUsers()
}

export const listUserGroupsAction = async () => {
  await requireAdminUser()
  return userService.listGroups()
}
