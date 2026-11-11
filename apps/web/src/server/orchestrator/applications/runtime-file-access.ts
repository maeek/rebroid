import { PublicActionError } from '@/server/errors/public-action-error'
import { resolveRuntimeFileAccess } from '@/shared/permissions/runtime-files'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from './actions/common/action-helpers'

export const assertCanTransferApplicationFiles = async (id: string) => {
  const context = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (!resolveRuntimeFileAccess(context.user.permissions).canTransferFiles) {
    throw new PublicActionError('You do not have permission to transfer files.', {
      code: 'forbidden',
      status: 403
    })
  }
  return context
}

export const assertCanManageApplicationFiles = async (id: string) => {
  const context = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (!resolveRuntimeFileAccess(context.user.permissions).canManageFiles) {
    throw new PublicActionError('You do not have permission to manage files.', {
      code: 'forbidden',
      status: 403
    })
  }
  return context
}
