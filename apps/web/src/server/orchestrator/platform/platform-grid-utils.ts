import { imageDisplayName } from '@/features/orchestrator/domain/image-display-name'
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

const pageBounds = (query: { page?: number; pageSize?: number }) => ({
  page: Math.max(Math.trunc(query.page ?? 1), 1),
  pageSize: Math.min(Math.max(Math.trunc(query.pageSize ?? 20), 1), 100)
})

const parseSorting = (sort: string | undefined, fallback: string, fields: Set<string>, descDefault: boolean) =>
  (sort || fallback)
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id || !fields.has(id)) return null
      return {
        id,
        desc: descDefault ? direction !== 'asc' : direction === 'desc'
      }
    })
    .filter((item): item is { id: string; desc: boolean } => Boolean(item))
    .slice(0, 3)

const containerSortFields = new Set(['name', 'state', 'image', 'applicationId'])

const containerName = (container: PlatformContainer) => container.names[0] ?? container.shortId

const sortContainers = (containers: PlatformContainer[], sort?: string) => {
  const sorting = parseSorting(sort, 'name:asc', containerSortFields, false)

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

export const platformContainersGridPage = (
  containers: PlatformContainer[],
  query: PlatformContainersGridQuery = {}
): PlatformContainersGridPage => {
  const { page, pageSize } = pageBounds(query)
  const search = query.q?.trim().toLowerCase()
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

const imageSortFields = new Set(['name', 'sizeBytes', 'createdAt', 'containers'])

const sortImages = (images: PlatformImage[], sort?: string) => {
  const sorting = parseSorting(sort, 'createdAt:desc', imageSortFields, true)

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

export const platformImagesGridPage = (
  images: PlatformImage[],
  query: PlatformImagesGridQuery = {}
): PlatformImagesGridPage => {
  const { page, pageSize } = pageBounds(query)
  const search = query.q?.trim().toLowerCase()
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

const networkSortFields = new Set(['name', 'driver', 'scope', 'containers'])

const sortNetworks = (networks: PlatformNetwork[], sort?: string) => {
  const sorting = parseSorting(sort, 'name:asc', networkSortFields, false)

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

export const platformNetworksGridPage = (
  networks: PlatformNetwork[],
  query: PlatformNetworksGridQuery = {}
): PlatformNetworksGridPage => {
  const { page, pageSize } = pageBounds(query)
  const search = query.q?.trim().toLowerCase()
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
