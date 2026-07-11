'use server'

import { revalidatePath } from 'next/cache'
import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { isAccentColor, type AccentColor } from '@/shared/model/theme/accent-color'

export const updateCurrentAccentColorAction = async (accentColor: AccentColor) =>
  runSafeAction(
    async () => {
      if (!isAccentColor(accentColor)) {
        throw new PublicActionError('Unsupported accent color.', { code: 'validation', status: 422 })
      }

      const user = await getCurrentUser()
      const updated = await userService.updateUser(user.id, { accentColor })
      revalidatePath('/', 'layout')
      return updated
    },
    { fallbackMessage: 'Could not save accent color.', logLabel: 'updateCurrentAccentColorAction failed' }
  )
