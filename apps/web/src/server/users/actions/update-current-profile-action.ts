'use server'

import { revalidatePath } from 'next/cache'
import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'

export const updateCurrentProfileAction = async (input: { avatarDataUrl: string | null }) =>
  runSafeAction(
    async () => {
      const user = await getCurrentUser()
      const updated = await userService.updateUser(user.id, { avatarDataUrl: input.avatarDataUrl })
      revalidatePath('/apps')
      return updated
    },
    { fallbackMessage: 'Could not update profile.', logLabel: 'updateCurrentProfileAction failed' }
  )
