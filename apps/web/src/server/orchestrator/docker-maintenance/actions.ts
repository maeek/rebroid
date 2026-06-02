'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import { orchestratorDockerMaintenanceClient } from './client'

export const pruneImagesAction = async (danglingOnly = true) => {
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
}

export const pruneContainersAction = async () => {
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
}

export const pruneNetworksAction = async () => {
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
}

export const pruneVolumesAction = async () => {
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
}

export const pruneAllDockerResourcesAction = async () => {
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
}
