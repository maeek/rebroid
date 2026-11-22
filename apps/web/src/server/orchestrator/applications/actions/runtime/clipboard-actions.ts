'use server'

import { recordApplicationAudit } from '@/server/audit/application-event'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import {
  assertCanUseOwnedApplicationRuntime,
  requireOwnedRuntimeContext,
  ownedRuntimeMessage
} from '../common/action-helpers'

export const getApplicationClipboardAction = async (id: string) => {
  const user = await requireOwnedRuntimeContext(id, ownedRuntimeMessage)
  if (!hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new PublicActionError('You do not have permission to sync clipboard.', { code: 'forbidden', status: 403 })
  }
  return orchestratorAppRuntimeClient.getClipboard(id)
}

export const setApplicationClipboardAction = async (id: string, text: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (!hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new PublicActionError('You do not have permission to sync clipboard.', { code: 'forbidden', status: 403 })
  }
  const result = await orchestratorAppRuntimeClient.setClipboard(id, text)
  recordApplicationAudit(
    user.ownerUserId,
    'application.clipboard.write',
    { id, name: app.name },
    { length: text.length }
  )
  return result
}
