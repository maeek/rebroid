import type { SortingState } from '@tanstack/react-table'

export const allFilterValue = 'all'

export const compactGridParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && text !== allFilterValue) params.set(key, text)
  }
  return params
}

export const sortFromSearchParam = (sort: string | undefined): SortingState =>
  (sort ?? 'updatedAt:desc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id) return null
      return { id, desc: direction !== 'asc' }
    })
    .filter((item): item is SortingState[number] => Boolean(item))
    .slice(0, 3)
