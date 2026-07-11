import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hashPassword, verifyPassword } from './password-hashing'
import { assertPasswordMeetsPolicy } from './password-policy'
import { nowIso, toPublicUser } from './user-model'
import { mutateUsersFile } from './user-store'

const changeOwnPassword = async (id: string, currentPassword: string, newPassword: string) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === id)
    if (!user) throw new PublicActionError('User not found.', { code: 'not_found', status: 404 })
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new PublicActionError('Current password is incorrect.', { code: 'validation', status: 422 })
    }
    await assertPasswordMeetsPolicy(newPassword)
    user.passwordHash = await hashPassword(newPassword)
    user.passwordChangeRequired = false
    user.sessionVersion += 1
    user.updatedAt = nowIso()
  })

const completeRequiredPasswordChange = async (id: string, currentPassword: string, newPassword: string) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === id)
    if (!user) throw new PublicActionError('User not found.', { code: 'not_found', status: 404 })
    if (!user.passwordChangeRequired) {
      throw new PublicActionError('Password change is not required for this account.', {
        code: 'conflict',
        status: 409
      })
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new PublicActionError('Current password is incorrect.', { code: 'validation', status: 422 })
    }
    await assertPasswordMeetsPolicy(newPassword)
    if (newPassword === currentPassword) {
      throw new PublicActionError('New password must be different from the current password.', {
        code: 'validation',
        status: 422
      })
    }
    user.passwordHash = await hashPassword(newPassword)
    user.passwordChangeRequired = false
    user.sessionVersion += 1
    user.updatedAt = nowIso()
    return toPublicUser(file, user)
  })

export const userPasswordService = { changeOwnPassword, completeRequiredPasswordChange }
