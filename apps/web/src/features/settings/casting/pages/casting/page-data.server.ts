import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import {
  getDisplaySidecarHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'
import { loadServiceContainers } from '@/server/orchestrator/platform/service-containers'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const loadCastingPageData = async (health: OrchestratorHealth) => {
  await requireAdmin()
  const [sidecarHealth, applications, users] = await Promise.all([
    getDisplaySidecarHealthAction(),
    orchestratorAppCatalogClient.listApplicationGallery(),
    userService.listUsers()
  ])
  const [sessions, containers] = await Promise.all([
    sidecarHealth.ok ? listDisplaySidecarSessionsAction() : [],
    loadServiceContainers(health, { displayHealth: sidecarHealth })
  ])

  return {
    applications: applications.map(({ id, name, ownerUserId }) => ({ id, name, ownerUserId })),
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions,
    containerId: containers.display?.id,
    sidecarHealth
  }
}
