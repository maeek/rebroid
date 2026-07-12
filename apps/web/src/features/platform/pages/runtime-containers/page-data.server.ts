import { listPlatformContainersGridAction } from '@/server/orchestrator/platform/container-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/server/orchestrator/platform/types'

export type ContainersSearchParams = PlatformGridSearchParams

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

const emptyContainersPage = (gridQuery: PlatformContainersGridQuery): PlatformContainersGridPage => ({
  items: [],
  total: 0,
  page: gridQuery.page ?? 1,
  pageSize: gridQuery.pageSize ?? 20,
  orphanedCount: 0,
  facets: { states: [], applications: [], images: [], networks: [] }
})

export const containersGridQueryFromSearchParams = (
  searchParams: ContainersSearchParams
): PlatformContainersGridQuery => platformGridQueryFromSearchParams(searchParams)

export const loadRuntimeContainersPageData = async (searchParams: ContainersSearchParams) => {
  const gridQuery = containersGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const containersPage = await listPlatformContainersGridAction(gridQuery).catch(error => {
    orchestratorError = errorMessage(error)
    return emptyContainersPage(gridQuery)
  })

  return {
    containersPage,
    gridQuery,
    orchestratorError
  }
}
