import { normalizePagination } from './pagination'

type SearchParamValue = string | string[] | undefined

export const firstSearchParamValue = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value)

const positivePageValue = (value: SearchParamValue) => {
  const number = Number(firstSearchParamValue(value))
  return Number.isFinite(number) && number >= 1 ? Math.min(number, Number.MAX_SAFE_INTEGER) : undefined
}

export const paginationFromSearchParams = (params: { page?: SearchParamValue; pageSize?: SearchParamValue }) =>
  normalizePagination({ page: positivePageValue(params.page), pageSize: positivePageValue(params.pageSize) })

export const validatedSearchParam = <T extends string>(value: SearchParamValue, allowed: ReadonlySet<T>) => {
  const candidate = firstSearchParamValue(value)
  return allowed.has(candidate as T) ? (candidate as T) : undefined
}

export const serializeSortParam = (sorting: ReadonlyArray<{ id: string; desc: boolean }>) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')
