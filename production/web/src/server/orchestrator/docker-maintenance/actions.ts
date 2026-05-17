'use server'

import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import { orchestratorDockerMaintenanceClient } from './client'

export const pruneImagesAction = async (danglingOnly = true) => {
  await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneImages(danglingOnly)
  revalidateOrchestratorPages()
  return result
}

export const pruneContainersAction = async () => {
  await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneContainers()
  revalidateOrchestratorPages()
  return result
}

export const pruneNetworksAction = async () => {
  await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneNetworks()
  revalidateOrchestratorPages()
  return result
}

export const pruneVolumesAction = async () => {
  await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneVolumes()
  revalidateOrchestratorPages()
  return result
}

export const pruneAllDockerResourcesAction = async () => {
  await requireAdminUser()
  const result = await orchestratorDockerMaintenanceClient.pruneAllDockerResources()
  revalidateOrchestratorPages()
  return result
}
