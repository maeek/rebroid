'use server'

import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { sanitizeApplicationLogForUser } from '../../safety'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const getApplicationLogsAction = async (
  id: string,
  source: 'orchestrator' | 'container' | 'adb',
  tail = 300
) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:view-logs')) {
    throw new PublicActionError('You do not have permission to view logs.', { code: 'forbidden', status: 403 })
  }
  const log = await orchestratorAppRuntimeClient.getApplicationLogs(id, source, tail)
  return sanitizeApplicationLogForUser(log, user)
}
