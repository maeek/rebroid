'use server'

import { hasPermission } from '@/shared/permissions/permissions'
import { orchestratorApplicationsClient } from '../../client'
import { sanitizeApplicationLogForUser } from '../../safety'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const getApplicationLogsAction = async (
  id: string,
  source: 'orchestrator' | 'container' | 'adb',
  tail = 300
) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:view-logs')) {
    throw new Error('You do not have permission to view logs.')
  }
  const log = await orchestratorApplicationsClient.getApplicationLogs(id, source, tail)
  return sanitizeApplicationLogForUser(log, user)
}
