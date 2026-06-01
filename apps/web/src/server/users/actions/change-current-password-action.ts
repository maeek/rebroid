'use server'

import { getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const changeCurrentPasswordAction = async (input: { currentPassword: string; newPassword: string }) => {
  const user = await getCurrentUser()
  await userService.changeOwnPassword(user.id, input.currentPassword, input.newPassword)
}
