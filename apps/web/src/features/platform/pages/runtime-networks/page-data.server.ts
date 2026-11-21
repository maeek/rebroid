import { listPlatformNetworksGridAction } from '@/server/orchestrator/platform/network-actions'
import { platformGridQueryFromSearchParams, type PlatformGridSearchParams } from '../platform-grid-search'

export const loadRuntimeNetworksPageData = async (searchParams: PlatformGridSearchParams) => {
  const gridQuery = platformGridQueryFromSearchParams(searchParams)
  return { gridQuery, networksPage: await listPlatformNetworksGridAction(gridQuery) }
}
