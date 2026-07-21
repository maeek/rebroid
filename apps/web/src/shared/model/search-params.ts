export type SearchParamValue = string | string[] | undefined

export const firstSearchParamValue = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value)

export const positiveIntegerSearchParam = (value: SearchParamValue, options: { fallback: number; max?: number }) => {
  const parsed = Number(firstSearchParamValue(value))
  if (!Number.isFinite(parsed) || parsed < 1) return options.fallback

  return Math.min(Math.trunc(parsed), options.max ?? Number.MAX_SAFE_INTEGER)
}

export const validatedSearchParam = <T extends string>(value: SearchParamValue, allowed: ReadonlySet<T>) => {
  const candidate = firstSearchParamValue(value)
  return allowed.has(candidate as T) ? (candidate as T) : undefined
}

export const serializeSortParam = (sorting: ReadonlyArray<{ id: string; desc: boolean }>) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')
