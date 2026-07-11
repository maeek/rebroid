'use server'

import { PublicActionError } from '@/server/errors/public-action-error'

import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const getApplicationClipboardAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new PublicActionError('You do not have permission to sync clipboard.', { code: 'forbidden', status: 403 })
  }
  return orchestratorAppRuntimeClient.getClipboard(id)
}

export const setApplicationClipboardAction = async (id: string, text: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new PublicActionError('You do not have permission to sync clipboard.', { code: 'forbidden', status: 403 })
  }
  const result = await orchestratorAppRuntimeClient.setClipboard(id, text)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.clipboard.write',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { length: text.length }
  })
  return result
}
