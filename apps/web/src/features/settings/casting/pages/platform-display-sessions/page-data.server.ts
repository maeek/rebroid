import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const loadPlatformDisplaySessionsPageData = async (initialHealth?: OrchestratorHealth) => {
  await requireAdmin()

  const health = initialHealth ?? (await getOrchestratorHealthAction())
  const [applications, users] = await Promise.all([listApplicationsAction(), userService.listUsers()])
  const sessions = health.services.display.ok ? await listDisplaySidecarSessionsAction() : []

  return {
    applications,
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions,
    sidecarHealth: health.services.display
  }
}
