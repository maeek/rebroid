'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const changeCurrentPasswordAction = async (input: { currentPassword: string; newPassword: string }) =>
  runSafeAction(
    async () => {
      const user = await getCurrentUser()
      if (user.passwordChangeRequired) {
        await userService.completeRequiredPasswordChange(user.id, input.currentPassword, input.newPassword)
        return
      }

      await userService.changeOwnPassword(user.id, input.currentPassword, input.newPassword)
    },
    { fallbackMessage: 'Could not change password.', logLabel: 'changeCurrentPasswordAction failed' }
  )
