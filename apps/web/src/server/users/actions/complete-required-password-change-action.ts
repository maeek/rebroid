'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { getAuthenticatedUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const completeRequiredPasswordChangeAction = async (input: { currentPassword: string; newPassword: string }) =>
  runSafeAction(
    async () => {
      const user = await getAuthenticatedUser()
      return userService.completeRequiredPasswordChange(user.id, input.currentPassword, input.newPassword)
    },
    {
      fallbackMessage: 'Could not change password.',
      logLabel: 'completeRequiredPasswordChangeAction failed'
    }
  )
