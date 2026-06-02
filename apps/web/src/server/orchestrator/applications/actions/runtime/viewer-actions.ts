'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorApplicationsClient } from '../../client'
import { sanitizeScrcpySessionForUser } from '../../safety'
import {
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeControlMessage,
  ownedRuntimeMessage
} from '../common/action-helpers'
import type { ApplicationViewerControlCommand } from '../../types'

export const getScrcpySessionAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  const session = await orchestratorApplicationsClient.getScrcpySession(id, {
    control: user.role === 'admin' || hasPermission(user.permissions, 'applications:control-viewer'),
    clipboard: user.role === 'admin' || hasPermission(user.permissions, 'applications:sync-clipboard')
  })
  return sanitizeScrcpySessionForUser(session, user)
}

export const recordViewerActivityAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  return orchestratorApplicationsClient.recordViewerActivity(id)
}

export const sendApplicationViewerControlAction = async (id: string, command: ApplicationViewerControlCommand) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new Error('You do not have permission to control this viewer.')
  }
  const result = await orchestratorApplicationsClient.sendViewerControl(id, command)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.viewer.control',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { command }
  })
  return result
}
