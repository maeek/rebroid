import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

export const getPlatformOperations = async (): Promise<PlatformOperationsSnapshot> => {
  await requireAdmin()
  const user = await getCurrentUserContext()
  const canInspectRuns =
    hasPermission(user.permissions, 'automations:run') && hasPermission(user.permissions, 'automations:manage')
  const [apps, runs] = await Promise.all([
    listApplicationsAction(),
    canInspectRuns ? orchestratorAutomationsClient.listActiveRuns(user.ownerUserId) : Promise.resolve([])
  ])
  const failed = apps.filter(app => app.status.currentStatus === 'error')
  const pending = apps.filter(
    app => app.status.currentStatus === 'provisioning' || app.status.currentStatus === 'removing'
  )
  return {
    failedCount: failed.length,
    pendingCount: pending.length,
    activeRunCount: runs.length,
    failed: failed
      .slice(0, 5)
      .map(app => ({ id: app.id, name: app.name, description: app.status.detail?.description ?? null })),
    pending: pending
      .slice(0, 5)
      .map(app => ({ id: app.id, name: app.name, title: app.status.detail?.title ?? app.status.currentStatus })),
    runs: runs.slice(0, 5).map(run => ({ id: run.id, automationId: run.automationId, status: run.status }))
  }
}
