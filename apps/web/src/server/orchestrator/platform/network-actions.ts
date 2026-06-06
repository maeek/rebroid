'use server'

import { requireAdminUser } from '../shared'
import { orchestratorPlatformClient } from './client'
import { runAuditedPlatformAction } from './platform-audit'
import { platformNetworksGridPage } from './platform-grid-utils'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from './types'

export const listPlatformNetworksAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformNetworks()
}

export const listPlatformNetworksGridAction = async (
  query: PlatformNetworksGridQuery = {}
): Promise<PlatformNetworksGridPage> => {
  await requireAdminUser()
  return platformNetworksGridPage(await orchestratorPlatformClient.listPlatformNetworks(), query)
}

export const getPlatformNetworkAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformNetwork(id)
}

export const removePlatformNetworkAction = async (id: string) =>
  runAuditedPlatformAction({
    action: 'docker.network.remove',
    operation: () => orchestratorPlatformClient.removePlatformNetwork(id),
    resourceType: 'docker_network',
    resourceId: id
  })
