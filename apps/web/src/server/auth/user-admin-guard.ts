import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { administratorsGroupId } from '@/shared/permissions/effective-access'
import type { StoredUser, UsersFile } from './user-model'

export const assertCanChangeAdministrator = (
  file: UsersFile,
  user: StoredUser,
  next: Pick<StoredUser, 'disabled' | 'groupIds'>
) => {
  if (user.disabled || !user.groupIds.includes(administratorsGroupId)) return
  if (!next.disabled && next.groupIds.includes(administratorsGroupId)) return
  const hasOtherAdmin = file.users.some(
    account => account.id !== user.id && !account.disabled && account.groupIds.includes(administratorsGroupId)
  )
  if (!hasOtherAdmin) {
    throw new PublicActionError('At least one enabled account must belong to Administrators.', {
      code: 'conflict',
      status: 409
    })
  }
}
