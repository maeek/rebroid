import 'server-only'
import type { StoredUser, UsersFile } from './user-model'

export const assertCanRemoveOrDisableUser = (file: UsersFile, user: StoredUser) => {
  if (user.role !== 'admin') return

  const activeAdmins = file.users.filter(item => item.role === 'admin' && !item.disabled)
  if (activeAdmins.length < 2) {
    throw new Error('Cannot remove or disable the last active admin.')
  }
}
