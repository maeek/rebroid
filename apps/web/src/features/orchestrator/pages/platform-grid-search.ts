export type PlatformGridSearchParams = Record<string, string | string[] | undefined>

type PlatformGridSearchQuery = {
  page: number
  pageSize: number
  q?: string
  scope: 'all' | 'managed'
  sort?: string
}

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export const platformGridQueryFromSearchParams = (searchParams: PlatformGridSearchParams): PlatformGridSearchQuery => {
  const scope = firstValue(searchParams.scope)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    scope: scope === 'all' ? 'all' : 'managed',
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}
