import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from './actions/common/action-helpers'

export const assertCanTransferApplicationFiles = async (id: string) => {
  const context = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (context.user.role !== 'admin' && !hasPermission(context.user.permissions, 'applications:transfer-files')) {
    throw new PublicActionError('You do not have permission to transfer files.', {
      code: 'forbidden',
      status: 403
    })
  }
  return context
}

export const assertCanManageApplicationFiles = async (id: string) => {
  const context = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (context.user.role !== 'admin' && !hasPermission(context.user.permissions, 'applications:manage-files')) {
    throw new PublicActionError('You do not have permission to manage files.', {
      code: 'forbidden',
      status: 403
    })
  }
  return context
}
