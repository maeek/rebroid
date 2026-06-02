'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import { orchestratorPlatformClient } from './client'

export const listPlatformContainersAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformContainers()
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

export const listPlatformImagesAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformImages()
}

export const getPlatformImageAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformImage(id)
}

export const removePlatformImageAction = async (id: string, force = false) => {
  const admin = await requireAdminUser()
  const result = await orchestratorPlatformClient.removePlatformImage(id, force)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'docker',
    action: 'docker.image.remove',
    resourceType: 'docker_image',
    resourceId: id,
    details: { force }
  })
  revalidateOrchestratorPages()
  return result
}

export const listPlatformNetworksAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformNetworks()
}

export const getPlatformNetworkAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorPlatformClient.getPlatformNetwork(id)
}

export const removePlatformNetworkAction = async (id: string) => {
  const admin = await requireAdminUser()
  const result = await orchestratorPlatformClient.removePlatformNetwork(id)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'docker',
    action: 'docker.network.remove',
    resourceType: 'docker_network',
    resourceId: id
  })
  revalidateOrchestratorPages()
  return result
}

export const stopPlatformContainerAction = async (id: string) => {
  const admin = await requireAdminUser()
  const result = await orchestratorPlatformClient.stopPlatformContainer(id)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'docker',
    action: 'docker.container.stop',
    resourceType: 'docker_container',
    resourceId: id
  })
  revalidateOrchestratorPages()
  return result
}

export const removePlatformContainerAction = async (id: string, force = false) => {
  const admin = await requireAdminUser()
  const result = await orchestratorPlatformClient.removePlatformContainer(id, force)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'docker',
    action: 'docker.container.remove',
    resourceType: 'docker_container',
    resourceId: id,
    details: { force }
  })
  revalidateOrchestratorPages()
  return result
}
