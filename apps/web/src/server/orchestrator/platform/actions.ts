'use server'

import { imageDisplayName } from '@/features/orchestrator/domain/image-display-name'
import { recordAuditEvent } from '@/server/audit/events'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import { orchestratorPlatformClient } from './client'
import type {
  PlatformContainer,
  PlatformContainersGridPage,
  PlatformContainersGridQuery,
  PlatformImage,
  PlatformImagesGridPage,
  PlatformImagesGridQuery,
  PlatformNetwork,
  PlatformNetworksGridPage,
  PlatformNetworksGridQuery
} from './types'

export const listPlatformContainersAction = async () => {
  await requireAdminUser()
  return orchestratorPlatformClient.listPlatformContainers()
}

const containerSortFields = new Set(['name', 'state', 'image', 'applicationId'])

const containerName = (container: PlatformContainer) => container.names[0] ?? container.shortId

const sortContainers = (containers: PlatformContainer[], sort?: string) => {
  const sorting = (sort || 'name:asc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id || !containerSortFields.has(id)) return null
      return { id, desc: direction === 'desc' }
    })
    .filter((item): item is { id: string; desc: boolean } => Boolean(item))
    .slice(0, 3)

  return [...containers].sort((left, right) => {
    if (left.orphaned !== right.orphaned) return left.orphaned ? -1 : 1
    if (left.managed !== right.managed) return left.managed ? -1 : 1
    for (const item of sorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'name') result = containerName(left).localeCompare(containerName(right))
      else if (item.id === 'state') result = left.state.localeCompare(right.state)
      else if (item.id === 'image') result = left.image.localeCompare(right.image)
      else if (item.id === 'applicationId') result = (left.applicationId ?? '').localeCompare(right.applicationId ?? '')
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

export const listPlatformContainersGridAction = async (
  query: PlatformContainersGridQuery = {}
): Promise<PlatformContainersGridPage> => {
  await requireAdminUser()
  const page = Math.max(Math.trunc(query.page ?? 1), 1)
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? 20), 1), 100)
  const search = query.q?.trim().toLowerCase()
  const containers = await orchestratorPlatformClient.listPlatformContainers()
  const orphanedCount = containers.filter(container => container.orphaned).length
  const scoped = query.scope === 'all' ? containers : containers.filter(container => container.managed)
  const filtered = search
    ? scoped.filter(container =>
        [
          container.id,
          container.shortId,
          ...container.names,
          container.image,
          container.imageId,
          container.command,
          container.state,
          container.status,
          container.orphaned ? 'orphaned' : '',
          container.applicationId ?? '',
          container.component ?? '',
          ...container.networks
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    : scoped
  const sorted = sortContainers(filtered, query.sort)
  const offset = (page - 1) * pageSize
  return { items: sorted.slice(offset, offset + pageSize), total: sorted.length, page, pageSize, orphanedCount }
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

const imageSortFields = new Set(['name', 'sizeBytes', 'createdAt', 'containers'])

const sortImages = (images: PlatformImage[], sort?: string) => {
  const sorting = (sort || 'createdAt:desc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id || !imageSortFields.has(id)) return null
      return { id, desc: direction !== 'asc' }
    })
    .filter((item): item is { id: string; desc: boolean } => Boolean(item))
    .slice(0, 3)

  return [...images].sort((left, right) => {
    for (const item of sorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'name') {
        result = imageDisplayName(left).localeCompare(imageDisplayName(right))
      } else if (item.id === 'sizeBytes') {
        result = left.sizeBytes - right.sizeBytes
      } else if (item.id === 'createdAt') {
        result = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      } else if (item.id === 'containers') {
        result = left.containers - right.containers
      }
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

export const listPlatformImagesGridAction = async (
  query: PlatformImagesGridQuery = {}
): Promise<PlatformImagesGridPage> => {
  await requireAdminUser()
  const page = Math.max(Math.trunc(query.page ?? 1), 1)
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? 20), 1), 100)
  const search = query.q?.trim().toLowerCase()
  const images = await orchestratorPlatformClient.listPlatformImages()
  const scoped = query.scope === 'all' ? images : images.filter(image => image.managed)
  const filtered = search
    ? scoped.filter(image =>
        [
          image.id,
          image.shortId,
          imageDisplayName(image),
          ...image.repoTags,
          ...image.repoDigests,
          String(image.sizeBytes),
          String(image.containers)
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    : scoped
  const sorted = sortImages(filtered, query.sort)
  const offset = (page - 1) * pageSize
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize
  }
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

const networkSortFields = new Set(['name', 'driver', 'scope', 'containers'])

const sortNetworks = (networks: PlatformNetwork[], sort?: string) => {
  const sorting = (sort || 'name:asc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id || !networkSortFields.has(id)) return null
      return { id, desc: direction === 'desc' }
    })
    .filter((item): item is { id: string; desc: boolean } => Boolean(item))
    .slice(0, 3)

  return [...networks].sort((left, right) => {
    if (left.managed !== right.managed) return left.managed ? -1 : 1
    for (const item of sorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'name') result = left.name.localeCompare(right.name)
      else if (item.id === 'driver') result = left.driver.localeCompare(right.driver)
      else if (item.id === 'scope') result = left.scope.localeCompare(right.scope)
      else if (item.id === 'containers') result = left.containers.length - right.containers.length
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

export const listPlatformNetworksGridAction = async (
  query: PlatformNetworksGridQuery = {}
): Promise<PlatformNetworksGridPage> => {
  await requireAdminUser()
  const page = Math.max(Math.trunc(query.page ?? 1), 1)
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? 20), 1), 100)
  const search = query.q?.trim().toLowerCase()
  const networks = await orchestratorPlatformClient.listPlatformNetworks()
  const scoped = query.scope === 'all' ? networks : networks.filter(network => network.managed)
  const filtered = search
    ? scoped.filter(network =>
        [
          network.id,
          network.shortId,
          network.name,
          network.driver,
          network.scope,
          ...network.subnets,
          ...network.gateways,
          ...network.containers
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    : scoped
  const sorted = sortNetworks(filtered, query.sort)
  const offset = (page - 1) * pageSize
  return { items: sorted.slice(offset, offset + pageSize), total: sorted.length, page, pageSize }
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
