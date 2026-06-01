'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import { orchestratorDockerMaintenanceClient } from './client'

export const pruneImagesAction = async (danglingOnly = true) => {
  const admin = await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneImages(danglingOnly)
  recordAuditEvent(admin.id, 'docker.prune.images', undefined, { danglingOnly })
  revalidateOrchestratorPages()
  return result
}

export const pruneContainersAction = async () => {
  const admin = await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneContainers()
  recordAuditEvent(admin.id, 'docker.prune.containers')
  revalidateOrchestratorPages()
  return result
}

export const pruneNetworksAction = async () => {
  const admin = await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneNetworks()
  recordAuditEvent(admin.id, 'docker.prune.networks')
  revalidateOrchestratorPages()
  return result
}

export const pruneVolumesAction = async () => {
  const admin = await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneVolumes()
  recordAuditEvent(admin.id, 'docker.prune.volumes')
  revalidateOrchestratorPages()
  return result
}

export const pruneAllDockerResourcesAction = async () => {
  const admin = await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneAllDockerResources()
  recordAuditEvent(admin.id, 'docker.prune.all')
  revalidateOrchestratorPages()
  return result
}
