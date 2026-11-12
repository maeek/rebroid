import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  getDisplaySidecarHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'
import { loadServiceContainerIds } from '@/server/orchestrator/platform/service-containers'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const loadCastingPageData = async (health: OrchestratorHealth) => {
  await requireAdmin()

  const [sidecarHealth, applications, users] = await Promise.all([
    getDisplaySidecarHealthAction(),
    listApplicationsAction(),
    userService.listUsers()
  ])
  const [sessions, containers] = await Promise.all([
    sidecarHealth.ok ? listDisplaySidecarSessionsAction() : [],
    loadServiceContainerIds(health, { displayHealth: sidecarHealth })
  ])

  return {
    applications,
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions,
    containerId: containers.display,
    sidecarHealth
  }
}
