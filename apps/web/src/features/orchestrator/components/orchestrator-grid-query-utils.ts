import type { SortingState } from '@tanstack/react-table'

export const compactPlatformGridParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && !(key === 'scope' && text === 'managed')) params.set(key, text)
  }
  return params
}

export const platformSortToSearchParam = (sorting: SortingState) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')

export const platformSortFromSearchParam = (sort: string | undefined): SortingState =>
  (sort ?? 'name:asc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id) return null
      return { id, desc: direction === 'desc' }
    })
    .filter((item): item is SortingState[number] => Boolean(item))
    .slice(0, 3)
