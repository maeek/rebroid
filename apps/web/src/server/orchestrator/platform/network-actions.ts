'use server'

import { requireAdminUser } from '../shared'
import { runSafeAction } from '@/server/actions/safe-action'
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
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.network.remove',
        operation: () => orchestratorPlatformClient.removePlatformNetwork(id),
        resourceType: 'docker_network',
        resourceId: id
      }),
    { fallbackMessage: 'Could not remove network.', logLabel: 'removePlatformNetworkAction failed' }
  )
