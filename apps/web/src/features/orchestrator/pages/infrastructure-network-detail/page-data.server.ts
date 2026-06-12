import { getPlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'

export const loadInfrastructureNetworkDetailPageData = async (id: string) => ({
  details: await getPlatformNetworkAction(id)
})
