'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/authorization'
import { userService, type UserRole } from '@/server/auth/user'

export const listUsersAction = async () => {
  await requireAdmin()
  return userService.listUsers()
}

export const createUserAction = async (input: { username: string; password: string; role: UserRole }) => {
  await requireAdmin()
  const user = await userService.createUser(input)
  revalidatePath('/settings/users')
  return user
}

export const setUserDisabledAction = async (id: string, disabled: boolean) => {
  await requireAdmin()
  const user = await userService.setUserDisabled(id, disabled)
  revalidatePath('/settings/users')
  return user
}

export const resetUserPasswordAction = async (id: string, password: string) => {
  await requireAdmin()
  const user = await userService.resetPassword(id, password)
  revalidatePath('/settings/users')
  return user
}

export const deleteUserAction = async (id: string) => {
  await requireAdmin()
  const user = await userService.deleteUser(id)
  revalidatePath('/settings/users')
  return user
}
