import { listPlatformContainersGridAction } from '@/server/orchestrator/platform/container-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformContainersGridQuery } from '@/shared/contracts/platform'

export type ContainersSearchParams = PlatformGridSearchParams

export const containersGridQueryFromSearchParams = (
  searchParams: ContainersSearchParams
): PlatformContainersGridQuery => platformGridQueryFromSearchParams(searchParams)

export const loadRuntimeContainersPageData = async (searchParams: ContainersSearchParams) => {
  const gridQuery = containersGridQueryFromSearchParams(searchParams)
  return { gridQuery, containersPage: await listPlatformContainersGridAction(gridQuery) }
}
