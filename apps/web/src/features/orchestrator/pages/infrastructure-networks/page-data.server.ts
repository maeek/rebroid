import { listPlatformNetworksGridAction } from '@/server/orchestrator/platform/network-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

export type NetworksSearchParams = PlatformGridSearchParams

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

const emptyNetworksPage = (gridQuery: PlatformNetworksGridQuery): PlatformNetworksGridPage => ({
  items: [],
  total: 0,
  page: gridQuery.page ?? 1,
  pageSize: gridQuery.pageSize ?? 20
})

export const networksGridQueryFromSearchParams = (searchParams: NetworksSearchParams): PlatformNetworksGridQuery =>
  platformGridQueryFromSearchParams(searchParams)

export const loadInfrastructureNetworksPageData = async (searchParams: NetworksSearchParams) => {
  const gridQuery = networksGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const networksPage = await listPlatformNetworksGridAction(gridQuery).catch(error => {
    orchestratorError = errorMessage(error)
    return emptyNetworksPage(gridQuery)
  })

  return {
    gridQuery,
    networksPage,
    orchestratorError
  }
}
