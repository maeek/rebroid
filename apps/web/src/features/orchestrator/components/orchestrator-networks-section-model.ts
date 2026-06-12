import { buildPlatformGridHref, summarizePlatformBulkRemoveResults } from './orchestrator-grid-query-utils'
import type { PlatformNetwork, PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

type NetworksGridHrefInput = {
  gridQuery: PlatformNetworksGridQuery
  pageSize: number
  patch: Partial<PlatformNetworksGridQuery>
}

export const buildNetworksGridHref = ({ gridQuery, pageSize, patch }: NetworksGridHrefInput) =>
  buildPlatformGridHref({
    basePath: '/infrastructure/networks',
    gridQuery,
    pageSize,
    patch
  })

export const networkHasAttachedContainers = (network: PlatformNetwork) => network.containers.length > 0

export const canRemoveSelectedNetworks = (networks: PlatformNetwork[]) =>
  networks.length > 0 && networks.every(network => !networkHasAttachedContainers(network))

export const summarizeNetworkRemoveResults = (results: PromiseSettledResult<unknown>[]) =>
  summarizePlatformBulkRemoveResults(results, 'network')
