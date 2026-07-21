'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const captureApplicationScreenshotAction = async (id: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:capture-screenshot')) {
    throw new PublicActionError('You do not have permission to capture screenshots.', {
      code: 'forbidden',
      status: 403
    })
  }
  const result = await orchestratorAppRuntimeClient.captureScreenshot(id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.screenshot.capture',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name
  })
  return result
}
