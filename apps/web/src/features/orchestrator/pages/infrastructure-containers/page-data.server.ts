import { listPlatformContainersGridAction } from '@/server/orchestrator/platform/container-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformContainersGridQuery } from '@/server/orchestrator/platform/types'

export type ContainersSearchParams = PlatformGridSearchParams

export const containersGridQueryFromSearchParams = (
  searchParams: ContainersSearchParams
): PlatformContainersGridQuery => platformGridQueryFromSearchParams(searchParams)

export const loadInfrastructureContainersPageData = async (searchParams: ContainersSearchParams) => {
  const gridQuery = containersGridQueryFromSearchParams(searchParams)
  const containersPage = await listPlatformContainersGridAction(gridQuery)

  return {
    containersPage,
    gridQuery
  }
}
