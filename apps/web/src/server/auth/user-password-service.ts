import 'server-only'
import { hashPassword, verifyPassword } from './password-hashing'
import { assertPasswordMeetsPolicy } from './password-policy'
import { nowIso, toPublicUser } from './user-model'
import { mutateUsersFile } from './user-store'

const changeOwnPassword = async (id: string, currentPassword: string, newPassword: string) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === id)
    if (!user) throw new Error('User not found.')
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new Error('Current password is incorrect.')
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
    if (!user) throw new Error('User not found.')
    if (!user.passwordChangeRequired) throw new Error('Password change is not required for this account.')
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new Error('Current password is incorrect.')
    }
    await assertPasswordMeetsPolicy(newPassword)
    if (newPassword === currentPassword) {
      throw new Error('New password must be different from the current password.')
    }
    user.passwordHash = await hashPassword(newPassword)
    user.passwordChangeRequired = false
    user.updatedAt = nowIso()
    return toPublicUser(file, user)
  })

export const userPasswordService = { changeOwnPassword, completeRequiredPasswordChange }
