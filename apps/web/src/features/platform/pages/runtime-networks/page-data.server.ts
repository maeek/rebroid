import { listPlatformNetworksGridAction } from '@/server/orchestrator/platform/network-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'
import type { PlatformNetworksGridQuery } from '@/shared/contracts/platform'

export type NetworksSearchParams = PlatformGridSearchParams

export const networksGridQueryFromSearchParams = (searchParams: NetworksSearchParams): PlatformNetworksGridQuery =>
  platformGridQueryFromSearchParams(searchParams)

export const loadRuntimeNetworksPageData = async (searchParams: NetworksSearchParams) => {
  const gridQuery = networksGridQueryFromSearchParams(searchParams)
  return { gridQuery, networksPage: await listPlatformNetworksGridAction(gridQuery) }
}
