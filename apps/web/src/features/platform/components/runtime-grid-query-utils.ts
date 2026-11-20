import { type ActionResult } from '@/shared/actions/action-result'
import { summarizeBulkResults } from '@/shared/actions/bulk-action-results'

type PlatformGridQuery = {
  page?: number
  pageSize?: number
  q?: string
  ownership?: string
  sort?: string
}

type PlatformGridHrefInput<TQuery extends PlatformGridQuery> = {
  basePath: string
  gridQuery: TQuery
  pageSize: number
  patch: Partial<TQuery>
}

type PlatformBulkRemoveToast = {
  title: string
  description?: string
  variant?: 'danger'
}

export const compactPlatformGridParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    const isDefaultOwnership = key === 'ownership' && text === 'managed'
    const isDefaultAllFilter =
      ['usage', 'runtimeKind', 'gmsMode', 'trait', 'attachment'].includes(key) && text === 'all'
    if (text && !isDefaultOwnership && !isDefaultAllFilter) params.set(key, text)
  }
  return params
}

export const buildPlatformGridHref = <TQuery extends PlatformGridQuery>({
  basePath,
  gridQuery,
  pageSize,
  patch
}: PlatformGridHrefInput<TQuery>) => {
  const query = { ...gridQuery, ...patch }
  const params = compactPlatformGridParams({
    ...query,
    ownership: query.ownership ?? 'managed',
    page: query.page ?? 1,
    pageSize: query.pageSize ?? pageSize
  })

  return `${basePath}${params.size ? `?${params.toString()}` : ''}`
}

export const summarizePlatformBulkRemoveResults = (
  results: Array<PromiseSettledResult<unknown> | ActionResult<unknown>>,
  resourceLabel: string
): PlatformBulkRemoveToast =>
  summarizeBulkResults(results, `Selected ${resourceLabel}s removed`, `Some ${resourceLabel}s could not be removed`)
