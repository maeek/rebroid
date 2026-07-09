import { buildPlatformGridHref, summarizePlatformBulkRemoveResults } from './runtime-grid-query-utils'
import type { PlatformNetwork, PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'
import type { ActionResult } from '@/shared/actions/action-result'

type NetworksGridHrefInput = {
  gridQuery: PlatformNetworksGridQuery
  pageSize: number
  patch: Partial<PlatformNetworksGridQuery>
}

export const buildNetworksGridHref = ({ gridQuery, pageSize, patch }: NetworksGridHrefInput) =>
  buildPlatformGridHref({
    basePath: '/runtime/networks',
    gridQuery,
    pageSize,
    patch
  })

export const networkHasAttachedContainers = (network: PlatformNetwork) => network.containers.length > 0

export const canRemoveSelectedNetworks = (networks: PlatformNetwork[]) =>
  networks.length > 0 && networks.every(network => !networkHasAttachedContainers(network))

export const summarizeNetworkRemoveResults = (results: Array<PromiseSettledResult<unknown> | ActionResult<unknown>>) =>
  summarizePlatformBulkRemoveResults(results, 'network')
