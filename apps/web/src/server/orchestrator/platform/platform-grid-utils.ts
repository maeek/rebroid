import { normalizePagination } from '@/shared/model/pagination'
import { parsePlatformInventorySort, type PlatformInventoryResource } from '@/shared/model/platform-inventory-sort'
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

const inventoryPage = <T extends { id: string }>(
  items: T[],
  query: { page?: number; pageSize?: number; sort?: string },
  resource: PlatformInventoryResource,
  compareField: (field: string, left: T, right: T) => number,
  priority?: (left: T, right: T) => number
) => {
  const { page, pageSize } = normalizePagination(query)
  const sorting = parsePlatformInventorySort(resource, query.sort)
  const sorted = items.toSorted((left, right) => {
    const rank = priority?.(left, right)
    if (rank) return rank
    for (const { id, desc } of sorting) {
      const order = compareField(id, left, right)
      if (order) return desc ? -order : order
    }
    return left.id.localeCompare(right.id)
  })
  const offset = (page - 1) * pageSize
  return { items: sorted.slice(offset, offset + pageSize), total: sorted.length, page, pageSize }
}

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value)))).toSorted((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  )

const containerName = (container: PlatformContainer) => container.names[0] ?? container.shortId

const compareContainers = (field: string, left: PlatformContainer, right: PlatformContainer) => {
  if (field === 'name') return containerName(left).localeCompare(containerName(right))
  if (field === 'state') return left.state.localeCompare(right.state)
  if (field === 'image') return left.image.localeCompare(right.image)
  if (field === 'applicationId') {
    return (left.applicationName ?? left.applicationId ?? '').localeCompare(
      right.applicationName ?? right.applicationId ?? ''
    )
  }
  return 0
}

const containerPriority = (left: PlatformContainer, right: PlatformContainer) =>
  Number(right.orphaned) - Number(left.orphaned) || Number(right.managed) - Number(left.managed)

export const platformContainersGridPage = (
  containers: PlatformContainer[],
  query: PlatformContainersGridQuery = {}
): PlatformContainersGridPage => {
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
          container.applicationName ?? '',
          container.component ?? '',
          ...container.networks
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    : structured
  return {
    ...inventoryPage(filtered, query, 'containers', compareContainers, containerPriority),
    orphanedCount,
    facets: {
      states: uniqueValues(containers.map(container => container.state)),
      applications: uniqueValues(containers.map(container => container.applicationId)),
      applicationNames: Object.fromEntries(
        containers.flatMap(container =>
          container.applicationId && container.applicationName
            ? [[container.applicationId, container.applicationName]]
            : []
        )
      ),
      images: uniqueValues(containers.map(container => container.image)),
      networks: uniqueValues(containers.flatMap(container => container.networks))
    }
  }
}

const compareImages = (field: string, left: PlatformImage, right: PlatformImage) => {
  if (field === 'name') return imageDisplayName(left).localeCompare(imageDisplayName(right))
  if (field === 'sizeBytes') return left.sizeBytes - right.sizeBytes
  if (field === 'createdAt') return Date.parse(left.createdAt) - Date.parse(right.createdAt)
  return field === 'containers' ? left.containers - right.containers : 0
}

export const platformImagesGridPage = (
  images: PlatformImage[],
  query: PlatformImagesGridQuery = {}
): PlatformImagesGridPage => {
  const search = query.q?.trim().toLowerCase()
  const imageDetails = images.map(image => ({ image, metadata: resolvePlatformImageRuntimeMetadata(image).metadata }))
  const scoped = query.ownership === 'all' ? imageDetails : imageDetails.filter(({ image }) => image.managed)
  const structured = scoped
    .filter(({ image, metadata }) => {
      if (query.usage === 'in-use' && image.containers <= 0) return false
      if (query.usage === 'unused' && image.containers !== 0) return false
      if (query.usage === 'unknown' && image.containers >= 0) return false
      if (query.runtimeKind && query.runtimeKind !== 'all' && metadata.runtimeKind !== query.runtimeKind) return false
      if (query.androidVersion && metadata.androidVersion !== query.androidVersion) return false
      if (query.architecture && metadata.architecture !== query.architecture) return false
      if (query.gmsMode && query.gmsMode !== 'all' && metadata.gmsMode !== query.gmsMode) return false
      return true
    })
    .map(({ image }) => image)
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
  return {
    ...inventoryPage(filtered, query, 'images', compareImages),
    facets: {
      androidVersions: uniqueValues(imageDetails.map(({ metadata }) => metadata.androidVersion)),
      architectures: uniqueValues(imageDetails.map(({ metadata }) => metadata.architecture))
    }
  }
}

const compareNetworks = (field: string, left: PlatformNetwork, right: PlatformNetwork) => {
  if (field === 'name' || field === 'driver' || field === 'scope') return left[field].localeCompare(right[field])
  return field === 'containers' ? left.containers.length - right.containers.length : 0
}

export const platformNetworksGridPage = (
  networks: PlatformNetwork[],
  query: PlatformNetworksGridQuery = {}
): PlatformNetworksGridPage => {
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
  return {
    ...inventoryPage(
      filtered,
      query,
      'networks',
      compareNetworks,
      (left, right) => Number(right.managed) - Number(left.managed)
    ),
    facets: {
      drivers: uniqueValues(networks.map(network => network.driver)),
      scopes: uniqueValues(networks.map(network => network.scope))
    }
  }
}
