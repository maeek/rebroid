import { isActionFailure, isActionResult, type ActionResult } from '@/shared/actions/action-result'
import type { SortingState } from '@tanstack/react-table'

type PlatformGridQuery = {
  page?: number
  pageSize?: number
  q?: string
  scope?: string
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
  variant?: 'destructive'
}

export const compactPlatformGridParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && !(key === 'scope' && text === 'managed')) params.set(key, text)
  }
  return params
}

export const buildPlatformGridHref = <TQuery extends PlatformGridQuery>({
  basePath,
  gridQuery,
  pageSize,
  patch
}: PlatformGridHrefInput<TQuery>) => {
  const query = {
    q: patch.q ?? gridQuery.q,
    scope: patch.scope ?? gridQuery.scope ?? 'managed',
    sort: patch.sort ?? gridQuery.sort,
    page: patch.page ?? gridQuery.page ?? 1,
    pageSize: patch.pageSize ?? gridQuery.pageSize ?? pageSize
  }

  const params = compactPlatformGridParams(query)

  return `${basePath}${params.size ? `?${params.toString()}` : ''}`
}

export const summarizePlatformBulkActionResults = (
  results: Array<PromiseSettledResult<unknown> | ActionResult<unknown>>,
  successTitle: string,
  failureTitle: string,
  requestLabel = 'request'
): PlatformBulkRemoveToast => {
  const failures = results.filter(result => {
    if (isActionResult(result)) return isActionFailure(result)
    if (result.status === 'rejected') return true
    return isActionFailure(result.value)
  })
  const failedCount = failures.length

  if (failedCount === 0) {
    return { title: successTitle }
  }

  const firstFailure = failures[0]
  let firstMessage: string | null = null
  if (isActionFailure(firstFailure)) {
    firstMessage = firstFailure.error.message
  } else if (firstFailure && !isActionResult(firstFailure) && firstFailure.status === 'fulfilled') {
    firstMessage = isActionFailure(firstFailure.value) ? firstFailure.value.error.message : null
  }

  return {
    title: failureTitle,
    description: firstMessage ?? `${failedCount} ${requestLabel}${failedCount === 1 ? '' : 's'} failed.`,
    variant: 'destructive'
  }
}

export const summarizePlatformBulkRemoveResults = (
  results: Array<PromiseSettledResult<unknown> | ActionResult<unknown>>,
  resourceLabel: string
): PlatformBulkRemoveToast =>
  summarizePlatformBulkActionResults(
    results,
    `Selected ${resourceLabel}s removed`,
    `Some ${resourceLabel}s could not be removed`,
    'remove request'
  )

export const platformSortToSearchParam = (sorting: SortingState) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')

export const platformSortFromSearchParam = (
  sort: string | undefined,
  options: { defaultSort?: string; missingDirection?: 'asc' | 'desc' } = {}
): SortingState =>
  (sort ?? options.defaultSort ?? 'name:asc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id) return null
      const normalizedDirection = direction ?? options.missingDirection ?? 'asc'
      return { id, desc: normalizedDirection === 'desc' }
    })
    .filter((item): item is SortingState[number] => Boolean(item))
    .slice(0, 3)

export const retainVisiblePlatformSelection = <T extends { id: string }>(items: T[], selectedIds: Set<string>) => {
  const visibleIds = new Set(items.map(item => item.id))

  return new Set([...selectedIds].filter(id => visibleIds.has(id)))
}

export const selectedPlatformItemsFromIds = <T extends { id: string }>(items: T[], selectedIds: Set<string>) =>
  items.filter(item => selectedIds.has(item.id))
