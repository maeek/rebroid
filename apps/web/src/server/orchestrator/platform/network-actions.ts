'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorPlatformClient } from './client'
import { resolveContainerApplicationNames } from './container-application-names'
import { runAuditedPlatformAction } from './platform-audit'
import { platformNetworksGridPage } from './platform-grid-utils'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/shared/contracts/platform'

export const listPlatformNetworksGridAction = async (
  query: PlatformNetworksGridQuery = {}
): Promise<PlatformNetworksGridPage> => {
  await requireAdmin()
  return platformNetworksGridPage(await orchestratorPlatformClient.listPlatformNetworks(), query)
}

export const getPlatformNetworkAction = async (id: string) => {
  await requireAdmin()
  const details = await orchestratorPlatformClient.getPlatformNetwork(id)
  return { ...details, relatedContainers: await resolveContainerApplicationNames(details.relatedContainers) }
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
