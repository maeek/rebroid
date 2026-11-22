const inventorySorting = {
  containers: { fields: ['name', 'state', 'image', 'applicationId'], fallback: 'name:asc', direction: 'asc' },
  images: { fields: ['name', 'sizeBytes', 'createdAt', 'containers'], fallback: 'createdAt:desc', direction: 'desc' },
  networks: { fields: ['name', 'driver', 'scope', 'containers'], fallback: 'name:asc', direction: 'asc' }
}

export type PlatformInventoryResource = keyof typeof inventorySorting

export const parsePlatformInventorySort = (resource: PlatformInventoryResource, sort: string | undefined) => {
  const { fields, fallback, direction: defaultDirection } = inventorySorting[resource]
  return (sort || fallback)
    .split(',')
    .flatMap(part => {
      const [id, direction] = part.split(':')
      if (!fields.includes(id)) return []
      const normalizedDirection = direction === 'asc' || direction === 'desc' ? direction : defaultDirection
      return [{ id, desc: normalizedDirection === 'desc' }]
    })
    .slice(0, 3)
}
