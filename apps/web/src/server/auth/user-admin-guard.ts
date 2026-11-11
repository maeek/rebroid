import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { administratorsGroupId } from '@/shared/permissions/effective-access'
import { isCurrentAccountSession, type AccountSessionIdentity } from './session-identity'
import type { StoredUser, UsersFile } from './user-model'

export const assertAdministratorForMutation = (file: UsersFile, identity: AccountSessionIdentity) => {
  const actor = file.users.find(user => user.id === identity.userId)
  if (
    !actor ||
    actor.passwordChangeRequired ||
    !actor.groupIds.includes(administratorsGroupId) ||
    !isCurrentAccountSession(actor, identity)
  ) {
    throw new PublicActionError('Administrator access changed. Sign in again and retry.', {
      code: 'forbidden',
      status: 403
    })
  }
}

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
