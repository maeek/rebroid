import { randomUUID } from 'node:crypto'
import 'server-only'
import { runWebMaintenance } from '@/server/maintenance/web-maintenance'
import { logger } from '@/server/observability/logger'
import { revokeViewerSessionsForUsers } from './revoke-viewer-sessions'
import type { PrepareViewerRevocation } from '@/server/auth/user-store'
import type { ViewerRevocationJob } from '@/server/persistence/web-maintenance-repository'

export const commitWithViewerRevocation = async <T>(
  requestId: string,
  commit: (prepare: PrepareViewerRevocation) => Promise<T>
) => {
  const jobId = randomUUID()
  let revocation: ViewerRevocationJob | undefined
  const value = await commit(async userIds => {
    if (!userIds.length) return undefined
    await revokeViewerSessionsForUsers(userIds, AbortSignal.timeout(20_000))
    revocation = { id: jobId, requestId, kind: 'viewer-revocation', userIds }
    return revocation
  })
  const complete = !revocation || (await runWebMaintenance(jobId))
  if (!complete) logger.warn('viewer.revocation_pending', { requestId, jobId })
  return { value, viewerRevocation: complete ? ('complete' as const) : ('pending' as const) }
}
