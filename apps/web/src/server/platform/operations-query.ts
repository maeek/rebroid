import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  canInspectActiveWorkflowRuns,
  listActiveWorkflowRuns
} from '@/server/orchestrator/automations/active-workflow-runs-query'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { isAppInProgress } from '@/shared/model/applications/app-gallery-status'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

export const getPlatformOperations = async (): Promise<PlatformOperationsSnapshot> => {
  await requireAdmin()
  const user = await getCurrentUserContext()
  const [apps, runs] = await Promise.all([
    listApplicationsAction(),
    canInspectActiveWorkflowRuns(user.permissions) ? listActiveWorkflowRuns(user.ownerUserId) : Promise.resolve([])
  ])
  const failedCount = apps.reduce((count, app) => count + Number(app.status.currentStatus === 'error'), 0)
  const pendingCount = apps.reduce(
    (count, app) => count + Number(isAppInProgress(app.status.currentStatus, app.status.lifecycleStage)),
    0
  )
  return {
    failedCount,
    pendingCount,
    activeRunCount: runs.length
  }
}
