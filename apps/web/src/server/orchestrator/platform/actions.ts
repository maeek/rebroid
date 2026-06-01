'use server'

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
  await requireAdminUser()
  const result = await orchestratorPlatformClient.removePlatformImage(id, force)
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
  await requireAdminUser()
  const result = await orchestratorPlatformClient.removePlatformNetwork(id)
  revalidateOrchestratorPages()
  return result
}

export const stopPlatformContainerAction = async (id: string) => {
  await requireAdminUser()
  const result = await orchestratorPlatformClient.stopPlatformContainer(id)
  revalidateOrchestratorPages()
  return result
}

export const removePlatformContainerAction = async (id: string, force = false) => {
  await requireAdminUser()
  const result = await orchestratorPlatformClient.removePlatformContainer(id, force)
  revalidateOrchestratorPages()
  return result
}
