'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { sanitizeScrcpySessionForUser } from '../../safety'
import { orchestratorAppViewerClient } from '../../viewer-client'
import {
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeControlMessage,
  ownedRuntimeMessage
} from '../common/action-helpers'
import type { ApplicationViewerControlCommand } from '@/shared/contracts/application'

export const getScrcpySessionAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  const session = await orchestratorAppViewerClient.getScrcpySession(id, {
    control: user.role === 'admin' || hasPermission(user.permissions, 'applications:control-viewer'),
    clipboard: user.role === 'admin' || hasPermission(user.permissions, 'applications:sync-clipboard'),
    screenshot: user.role === 'admin' || hasPermission(user.permissions, 'applications:capture-screenshot')
  })
  return sanitizeScrcpySessionForUser(session, user)
}

export const recordViewerActivityAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  return orchestratorAppViewerClient.recordViewerActivity(id)
}

export const sendApplicationViewerControlAction = async (id: string, command: ApplicationViewerControlCommand) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new PublicActionError('You do not have permission to control this viewer.', {
      code: 'forbidden',
      status: 403
    })
  }
  const result = await orchestratorAppViewerClient.sendViewerControl(id, command)
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

export const createApplicationVirtualDisplayAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new PublicActionError('You do not have permission to add displays for this viewer.', {
      code: 'forbidden',
      status: 403
    })
  }

  return orchestratorAppViewerClient.createVirtualDisplay(id)
}

export const releaseApplicationVirtualDisplayAction = async (id: string, surfaceId: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new PublicActionError('You do not have permission to close displays for this viewer.', {
      code: 'forbidden',
      status: 403
    })
  }

  return orchestratorAppViewerClient.releaseVirtualDisplay(id, surfaceId)
}

export const startApplicationDisplayRecordingAction = async (id: string, surfaceId: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:capture-screenshot')) {
    throw new PublicActionError('You do not have permission to record this viewer.', { code: 'forbidden', status: 403 })
  }

  return orchestratorAppViewerClient.startRecording(id, surfaceId)
}

export const stopApplicationDisplayRecordingAction = async (id: string, surfaceId: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:capture-screenshot')) {
    throw new PublicActionError('You do not have permission to record this viewer.', { code: 'forbidden', status: 403 })
  }

  return orchestratorAppViewerClient.stopRecording(id, surfaceId)
}
