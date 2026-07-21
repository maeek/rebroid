'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { requireAdminUser } from '../shared'
import { orchestratorPlatformClient } from './client'
import { runAuditedPlatformAction } from './platform-audit'
import { platformContainersGridPage } from './platform-grid-utils'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/shared/contracts/platform'

export const listPlatformContainersAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformContainers()
}

export const listPlatformContainersGridAction = async (
  query: PlatformContainersGridQuery = {}
): Promise<PlatformContainersGridPage> => {
  await requireAdminUser()
  return platformContainersGridPage(await orchestratorPlatformClient.listPlatformContainers(), query)
}

export const getPlatformContainerAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformContainer(id)
}

export const getPlatformContainerLogsAction = async (id: string, tail = 500) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformContainerLogs(id, tail)
}

export const getPlatformContainerStatsAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformContainerStats(id)
}

export const stopPlatformContainerAction = async (id: string) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.container.stop',
        operation: () => orchestratorPlatformClient.stopPlatformContainer(id),
        resourceType: 'docker_container',
        resourceId: id
      }),
    { fallbackMessage: 'Could not stop container.', logLabel: 'stopPlatformContainerAction failed' }
  )

export const removePlatformContainerAction = async (id: string, force = false) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.container.remove',
        details: { force },
        operation: () => orchestratorPlatformClient.removePlatformContainer(id, force),
        resourceType: 'docker_container',
        resourceId: id
      }),
    { fallbackMessage: 'Could not remove container.', logLabel: 'removePlatformContainerAction failed' }
  )
