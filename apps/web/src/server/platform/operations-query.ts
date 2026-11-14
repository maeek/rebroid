import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  canInspectActiveWorkflowRuns,
  listActiveWorkflowRuns
} from '@/server/orchestrator/automations/active-workflow-runs-query'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { loadFeatureFlags } from '@/server/orchestrator/features'
import { isAppInProgress } from '@/shared/model/applications/app-gallery-status'
import { workflowTraceHref } from '@/shared/model/workflow-trace-href'
import { hasPermission } from '@/shared/permissions/permissions'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

const overviewItemLimit = 3

export const getPlatformOperations = async (): Promise<PlatformOperationsSnapshot> => {
  await requireAdmin()
  const user = await getCurrentUserContext()
  const [apps, runs, manifest] = await Promise.all([
    listApplicationsAction(),
    canInspectActiveWorkflowRuns(user.permissions) ? listActiveWorkflowRuns(user.ownerUserId) : null,
    hasPermission(user.permissions, 'automations:manage') ? loadFeatureFlags() : null
  ])
  return {
    collectedAt: new Date().toISOString(),
    failedCount: apps.filter(app => app.status.currentStatus === 'error').length,
    pendingCount: apps.filter(app => isAppInProgress(app.status.currentStatus, app.status.lifecycleStage)).length,
    activeRunCount: runs?.length ?? null,
    activeRuns: (runs ?? []).slice(0, overviewItemLimit).map(run => ({
      id: run.id,
      name: run.workflowName ?? 'Workflow run',
      impact: run.status === 'queued' ? 'Queued' : 'Running',
      href: workflowTraceHref(run.automationId, run.id)
    })),
    workflowCatalogAvailable:
      manifest?.features.some(feature => feature.key === 'feature.workflows' && feature.enabled && feature.supported) ??
      false
  }
}
