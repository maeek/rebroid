'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { runAuditedPlatformAction } from '../platform/platform-audit'
import { orchestratorDockerMaintenanceClient } from './client'

export const pruneImagesAction = async (danglingOnly = true) =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.prune.images',
        operation: () => orchestratorDockerMaintenanceClient.pruneImages(danglingOnly),
        resourceType: 'docker_image',
        details: { danglingOnly }
      }),
    { fallbackMessage: 'Could not prune images.', logLabel: 'pruneImagesAction failed' }
  )

export const pruneContainersAction = async () =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.prune.containers',
        operation: () => orchestratorDockerMaintenanceClient.pruneContainers(),
        resourceType: 'docker_container'
      }),
    { fallbackMessage: 'Could not prune containers.', logLabel: 'pruneContainersAction failed' }
  )

export const pruneNetworksAction = async () =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.prune.networks',
        operation: () => orchestratorDockerMaintenanceClient.pruneNetworks(),
        resourceType: 'docker_network'
      }),
    { fallbackMessage: 'Could not prune networks.', logLabel: 'pruneNetworksAction failed' }
  )

export const pruneVolumesAction = async () =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.prune.volumes',
        operation: () => orchestratorDockerMaintenanceClient.pruneVolumes(),
        resourceType: 'docker_volume'
      }),
    { fallbackMessage: 'Could not prune volumes.', logLabel: 'pruneVolumesAction failed' }
  )

export const pruneAllDockerResourcesAction = async () =>
  runSafeAction(
    () =>
      runAuditedPlatformAction({
        action: 'docker.prune.all',
        operation: () => orchestratorDockerMaintenanceClient.pruneAllDockerResources(),
        resourceType: 'docker'
      }),
    { fallbackMessage: 'Could not prune Docker resources.', logLabel: 'pruneAllDockerResourcesAction failed' }
  )
