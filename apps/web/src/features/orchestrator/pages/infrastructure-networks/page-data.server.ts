import { listPlatformNetworksGridAction } from '@/server/orchestrator/platform/network-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

export type NetworksSearchParams = PlatformGridSearchParams

export const networksGridQueryFromSearchParams = (searchParams: NetworksSearchParams): PlatformNetworksGridQuery =>
  platformGridQueryFromSearchParams(searchParams)

export const loadInfrastructureNetworksPageData = async (searchParams: NetworksSearchParams) => {
  const gridQuery = networksGridQueryFromSearchParams(searchParams)
  const networksPage = await listPlatformNetworksGridAction(gridQuery)

  return {
    gridQuery,
    networksPage
  }
}
