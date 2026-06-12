import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'

export const loadOperationsCastingPageData = async () => {
  await requireAdmin()

  const [health, applications, users] = await Promise.all([
    getOrchestratorHealthAction(),
    listApplicationsAction(),
    userService.listUsers()
  ])
  const sessions = health.services.display.ok ? await listDisplaySidecarSessionsAction().catch(() => []) : []

  return {
    applications,
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions,
    sidecarHealth: health.services.display
  }
}
