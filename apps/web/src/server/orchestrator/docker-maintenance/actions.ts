'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import { orchestratorDockerMaintenanceClient } from './client'

export const pruneImagesAction = async (danglingOnly = true) =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const result = await orchestratorDockerMaintenanceClient.pruneImages(danglingOnly)
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'docker',
        action: 'docker.prune.images',
        resourceType: 'docker_image',
        details: { danglingOnly }
      })
      revalidateOrchestratorPages()
      return result
    },
    { fallbackMessage: 'Could not prune images.', logLabel: 'pruneImagesAction failed' }
  )

export const pruneContainersAction = async () =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const result = await orchestratorDockerMaintenanceClient.pruneContainers()
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'docker',
        action: 'docker.prune.containers',
        resourceType: 'docker_container'
      })
      revalidateOrchestratorPages()
      return result
    },
    { fallbackMessage: 'Could not prune containers.', logLabel: 'pruneContainersAction failed' }
  )

export const pruneNetworksAction = async () =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const result = await orchestratorDockerMaintenanceClient.pruneNetworks()
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'docker',
        action: 'docker.prune.networks',
        resourceType: 'docker_network'
      })
      revalidateOrchestratorPages()
      return result
    },
    { fallbackMessage: 'Could not prune networks.', logLabel: 'pruneNetworksAction failed' }
  )

export const pruneVolumesAction = async () =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const result = await orchestratorDockerMaintenanceClient.pruneVolumes()
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'docker',
        action: 'docker.prune.volumes',
        resourceType: 'docker_volume'
      })
      revalidateOrchestratorPages()
      return result
    },
    { fallbackMessage: 'Could not prune volumes.', logLabel: 'pruneVolumesAction failed' }
  )

export const pruneAllDockerResourcesAction = async () =>
  runSafeAction(
    async () => {
      const admin = await requireAdminUser()
      const result = await orchestratorDockerMaintenanceClient.pruneAllDockerResources()
      recordAuditEvent({
        actorUserId: admin.id,
        actorLabel: admin.name || admin.username || admin.id,
        category: 'docker',
        action: 'docker.prune.all',
        resourceType: 'docker'
      })
      revalidateOrchestratorPages()
      return result
    },
    { fallbackMessage: 'Could not prune Docker resources.', logLabel: 'pruneAllDockerResourcesAction failed' }
  )
