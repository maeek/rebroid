import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import type { StoredUser, UsersFile } from './user-model'

export const assertCanRemoveOrDisableUser = (file: UsersFile, user: StoredUser) => {
  if (user.role !== 'admin') return

  const activeAdmins = file.users.filter(item => item.role === 'admin' && !item.disabled)
  if (activeAdmins.length < 2) {
    throw new PublicActionError('Cannot remove or disable the last active admin.', { code: 'conflict', status: 409 })
  }
}

export const assertCanUpdateUser = (
  file: UsersFile,
  user: StoredUser,
  update: { disabled?: boolean; role?: StoredUser['role'] }
) => {
  if (user.role !== 'admin' || user.disabled) return

  const nextRole = update.role ?? user.role
  const nextDisabled = update.disabled ?? user.disabled
  if (nextRole === 'admin' && !nextDisabled) return

  assertCanRemoveOrDisableUser(file, user)
}
