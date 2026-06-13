'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { isAccentColor, type AccentColor } from '@/shared/model/theme/accent-color'

export const updateCurrentAccentColorAction = async (accentColor: AccentColor) => {
  if (!isAccentColor(accentColor)) {
    throw new Error('Unsupported accent color.')
  }

  const user = await getCurrentUser()
  const updated = await userService.updateUser(user.id, { accentColor })
  revalidatePath('/', 'layout')
  return updated
}
