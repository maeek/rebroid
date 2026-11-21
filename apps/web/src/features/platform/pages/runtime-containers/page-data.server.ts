import { listPlatformContainersGridAction } from '@/server/orchestrator/platform/container-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'

export const loadRuntimeContainersPageData = async (searchParams: PlatformGridSearchParams) => {
  const gridQuery = platformGridQueryFromSearchParams(searchParams)
  return { gridQuery, containersPage: await listPlatformContainersGridAction(gridQuery) }
}
