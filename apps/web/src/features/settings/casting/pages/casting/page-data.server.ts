import { requireAdmin } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import {
  getDisplaySidecarHealthAction,
  listDisplaySidecarSessionsAction
} from '@/server/orchestrator/diagnostics/actions'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'
import { loadServiceContainers } from '@/server/orchestrator/platform/service-containers'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const loadCastingPageData = async (health: OrchestratorHealth) => {
  await requireAdmin()
  const externalEnabled = Boolean(process.env.EXTERNAL_ADB_BROKER_SECRET)

  const [sidecarHealth, applications, users, externalAvailability] = await Promise.all([
    getDisplaySidecarHealthAction(),
    orchestratorAppCatalogClient.listApplicationGallery(),
    userService.listUsers(),
    externalDeviceClient.availability().catch(() => ({ enabled: false, status: 'broker_unavailable' }) as const)
  ])
  const [sessions, containers] = await Promise.all([
    sidecarHealth.ok || externalEnabled ? listDisplaySidecarSessionsAction(sidecarHealth.ok) : [],
    loadServiceContainers(health, { displayHealth: sidecarHealth })
  ])

  return {
    applications: applications.map(({ id, name, ownerUserId }) => ({ id, name, ownerUserId })),
    owners: users.map(user => ({ id: user.id, name: user.name || user.username })),
    sessions,
    containerId: containers.display?.id,
    externalEnabled,
    externalAvailability,
    sidecarHealth
  }
}
