import { randomUUID } from 'node:crypto'
import 'server-only'
import { runWebMaintenance } from '@/server/maintenance/web-maintenance'
import { logger } from '@/server/observability/logger'
import type { ViewerRevocationJob } from '@/server/persistence/web-maintenance-repository'

export const createViewerRevocationJob = (
  userIds: readonly string[],
  requestId: string = randomUUID()
): ViewerRevocationJob => ({
  id: randomUUID(),
  requestId,
  kind: 'viewer-revocation',
  userIds
})

export const finishViewerRevocation = async (job: ViewerRevocationJob) => {
  const complete = await runWebMaintenance(job.id)
  if (!complete) logger.warn('viewer.revocation_pending', { requestId: job.requestId, jobId: job.id })
  return complete
}
