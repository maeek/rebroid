'use server'

import { getCurrentUser } from '@/server/auth/authorization'
import { runSafeAction } from '@/server/actions/safe-action'
import { userService } from '@/server/auth/user'

export const completeRequiredPasswordChangeAction = async (input: { currentPassword: string; newPassword: string }) =>
  runSafeAction(
    async () => {
      const user = await getCurrentUser()
      return userService.completeRequiredPasswordChange(user.id, input.currentPassword, input.newPassword)
    },
    {
      fallbackMessage: 'Could not change password.',
      logLabel: 'completeRequiredPasswordChangeAction failed'
    }
  )
