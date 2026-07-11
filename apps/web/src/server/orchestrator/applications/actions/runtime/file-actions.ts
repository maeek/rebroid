'use server'

import { PublicActionError } from '@/server/errors/public-action-error'

import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

const assertCanTransferFiles = (user: Awaited<ReturnType<typeof assertCanUseOwnedApplicationRuntime>>['user']) => {
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new PublicActionError('You do not have permission to transfer files.', { code: 'forbidden', status: 403 })
  }
}

export const listApplicationFilesAction = async (id: string, path: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  assertCanTransferFiles(user)
  return orchestratorAppRuntimeClient.listFiles(id, path)
}

export const downloadApplicationRuntimeFileAction = async (id: string, path: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  assertCanTransferFiles(user)
  const result = await orchestratorAppRuntimeClient.downloadRuntimeFile(id, path)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.file.download',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { path, name: result.name }
  })
  return result
}
