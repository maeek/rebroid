'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { sanitizeScrcpySessionForUser } from '../../safety'
import { orchestratorAppViewerClient } from '../../viewer-client'
import { assertViewerRevocationComplete, issueViewerGrant } from '../../viewer-grant-access'
import {
  assertCanUseOwnedApplicationRuntime,
  requireOwnedRuntimeContext,
  ownedRuntimeControlMessage
} from '../common/action-helpers'
import type { ApplicationViewerControlCommand } from '@/shared/contracts/application'

export const getScrcpySessionAction = async (id: string) =>
  runSafeAction(
    async () => {
      const { grant, user } = await issueViewerGrant(id, 'main', access =>
        orchestratorAppViewerClient.getScrcpySession(id, access)
      )
      return sanitizeScrcpySessionForUser(grant, user)
    },
    { fallbackMessage: 'Could not open the live display session.', logLabel: 'Open display session' }
  )

export const recordViewerActivityAction = async (id: string, runtimeKey: string) =>
  runSafeAction(
    async () => {
      const user = await getCurrentUserContext()
      assertViewerRevocationComplete(user.ownerUserId)
      if (typeof runtimeKey !== 'string' || !/^[a-f0-9]{64}$/.test(runtimeKey)) {
        throw new PublicActionError('Invalid viewer runtime.', { code: 'validation', status: 400 })
      }
      await orchestratorAppViewerClient.recordViewerActivity(id, user.ownerUserId, runtimeKey)
    },
    { fallbackMessage: 'Could not record viewer activity.', logLabel: 'Record viewer activity' }
  )

export const sendApplicationViewerControlAction = async (id: string, command: ApplicationViewerControlCommand) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (!hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new PublicActionError('You do not have permission to control this viewer.', {
      code: 'forbidden',
      status: 403
    })
  }
  const result = await orchestratorAppViewerClient.sendViewerControl(id, command)
  recordApplicationAudit(user.ownerUserId, 'application.viewer.control', { id, name: app.name }, { command })
  return result
}

export const createApplicationVirtualDisplayAction = async (id: string) => {
  const { grant } = await issueViewerGrant(id, 'virtual', access =>
    orchestratorAppViewerClient.createVirtualDisplay(id, access)
  )
  return grant
}

export const releaseApplicationVirtualDisplayAction = async (id: string, surfaceId: string) => {
  const user = await requireOwnedRuntimeContext(id, ownedRuntimeControlMessage)
  if (!hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new PublicActionError('You do not have permission to close displays for this viewer.', {
      code: 'forbidden',
      status: 403
    })
  }

  return orchestratorAppViewerClient.releaseVirtualDisplay(id, surfaceId)
}
