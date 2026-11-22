'use server'

import { recordApplicationAudit } from '@/server/audit/application-event'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const captureApplicationScreenshotAction = async (id: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (!hasPermission(user.permissions, 'applications:capture-screenshot')) {
    throw new PublicActionError('You do not have permission to capture screenshots.', {
      code: 'forbidden',
      status: 403
    })
  }
  const result = await orchestratorAppRuntimeClient.captureScreenshot(id)
  recordApplicationAudit(user.ownerUserId, 'application.screenshot.capture', { id, name: app.name })
  return result
}
