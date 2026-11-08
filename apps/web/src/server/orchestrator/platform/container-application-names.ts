import 'server-only'
import { orchestratorAppCatalogClient } from '../applications/catalog-client'
import { requireAdminUser } from '../shared'
import type { PlatformContainer } from '@/shared/contracts/platform'

export const resolveContainerApplicationNames = async (
  containers: PlatformContainer[]
): Promise<PlatformContainer[]> => {
  await requireAdminUser()
  if (!containers.some(container => container.applicationId)) return containers
  // One lightweight stored-state lookup for the whole inventory, never one request per row.
  const applications = await orchestratorAppCatalogClient.listApplicationSummaries().catch(() => [])
  const names = new Map(applications.map(app => [app.id, app.name]))
  return containers.map(container => ({
    ...container,
    applicationName: container.applicationId ? (names.get(container.applicationId) ?? null) : null
  }))
}
