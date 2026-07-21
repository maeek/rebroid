import { imageDisplayName } from '@/shared/model/runtime-image/image-display-name'
import { resolvePlatformImageRuntimeMetadata } from '@/shared/model/runtime-image/runtime-image-metadata'
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
} from '@/shared/contracts/platform'

const pageBounds = (query: { page?: number; pageSize?: number }) => ({
  page: Math.max(Math.trunc(query.page ?? 1), 1),
  pageSize: Math.min(Math.max(Math.trunc(query.pageSize ?? 20), 1), 100)
})

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value)))).toSorted((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  )

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
  const scoped = query.ownership === 'all' ? containers : containers.filter(container => container.managed)
  const structured = scoped.filter(container => {
    if (query.state && container.state !== query.state) return false
    if (query.application && container.applicationId !== query.application) return false
    if (query.image && container.image !== query.image) return false
    if (query.network && !container.networks.includes(query.network)) return false
    return true
  })
  const filtered = search
    ? structured.filter(container =>
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
    : structured
  const sorted = sortContainers(filtered, query.sort)
  const offset = (page - 1) * pageSize
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
    orphanedCount,
    facets: {
      states: uniqueValues(containers.map(container => container.state)),
      applications: uniqueValues(containers.map(container => container.applicationId)),
      images: uniqueValues(containers.map(container => container.image)),
      networks: uniqueValues(containers.flatMap(container => container.networks))
    }
  }
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
  const scoped = query.ownership === 'all' ? images : images.filter(image => image.managed)
  const structured = scoped.filter(image => {
    const metadata = resolvePlatformImageRuntimeMetadata(image).metadata
    if (query.usage === 'in-use' && image.containers <= 0) return false
    if (query.usage === 'unused' && image.containers !== 0) return false
    if (query.usage === 'unknown' && image.containers >= 0) return false
    if (query.runtimeKind && query.runtimeKind !== 'all' && metadata.runtimeKind !== query.runtimeKind) return false
    if (query.androidVersion && metadata.androidVersion !== query.androidVersion) return false
    if (query.architecture && metadata.architecture !== query.architecture) return false
    if (query.gmsMode && query.gmsMode !== 'all' && metadata.gmsMode !== query.gmsMode) return false
    return true
  })
  const filtered = search
    ? structured.filter(image =>
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
    : structured
  const sorted = sortImages(filtered, query.sort)
  const offset = (page - 1) * pageSize
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
    facets: {
      androidVersions: uniqueValues(
        images.map(image => resolvePlatformImageRuntimeMetadata(image).metadata.androidVersion)
      ),
      architectures: uniqueValues(images.map(image => resolvePlatformImageRuntimeMetadata(image).metadata.architecture))
    }
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
  const scoped = query.ownership === 'all' ? networks : networks.filter(network => network.managed)
  const structured = scoped.filter(network => {
    if (query.driver && network.driver !== query.driver) return false
    if (query.dockerScope && network.scope !== query.dockerScope) return false
    if (query.trait === 'internal' && !network.internal) return false
    if (query.trait === 'attachable' && !network.attachable) return false
    if (query.trait === 'ingress' && !network.ingress) return false
    if (query.attachment === 'attached' && network.containers.length === 0) return false
    if (query.attachment === 'unattached' && network.containers.length > 0) return false
    return true
  })
  const filtered = search
    ? structured.filter(network =>
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
    : structured
  const sorted = sortNetworks(filtered, query.sort)
  const offset = (page - 1) * pageSize
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
    facets: {
      drivers: uniqueValues(networks.map(network => network.driver)),
      scopes: uniqueValues(networks.map(network => network.scope))
    }
  }
}
