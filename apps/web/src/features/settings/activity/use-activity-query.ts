import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { serializeSortParam } from '@/shared/model/search-params'
import { useRoutedGridQuery } from '@/shared/ui/data-grid/use-routed-grid-query'
import { activityFilterEntries, compactActivityParams } from './activity-format'
import type { ActivityEventsTableProps } from './activity-types'
import type { AuditFilterValues } from '@/shared/contracts/audit'
import type { SortingState } from '@tanstack/react-table'

type QueryPatch = Partial<AuditFilterValues> & { page?: number; pageSize?: number; sort?: string }
type ActivityQuery = QueryPatch & { page: number; pageSize: number }

const defaultSort = 'createdAt:desc'
const dateQueryValue = (value: string | undefined, boundary: string) =>
  value?.endsWith(`T${boundary}`) ? value.slice(0, 10) : value

export const useActivityQuery = ({
  filters,
  sorting,
  result,
  application,
  facets,
  loading
}: ActivityEventsTableProps) => {
  const router = useRouter()
  const basePath = application ? `/app/${encodeURIComponent(application.id)}` : '/security/audit-log'
  const appScope = application ? { resourceType: 'application', resourceId: application.id } : {}

  const hrefFor = (query: ActivityQuery) => {
    const params = compactActivityParams({
      ...query,
      from: dateQueryValue(query.from, '00:00:00.000Z'),
      to: dateQueryValue(query.to, '23:59:59.999Z'),
      sort: query.sort === defaultSort ? undefined : query.sort
    })
    if (application) {
      params.set('view', 'activity')
      params.delete('resourceType')
      params.delete('resourceId')
    }
    return `${basePath}?${params}`
  }

  const { query, searchDraft, setSearchDraft, isNavigating, submit } = useRoutedGridQuery<ActivityQuery>({
    committedQuery: {
      ...filters,
      ...appScope,
      sort: serializeSortParam(sorting),
      page: result.page,
      pageSize: result.pageSize
    },
    hrefFor,
    searchFrom: next => next.search,
    navigate: href => router.push(href)
  })

  const pushParams = (patch: QueryPatch) => {
    if (loading) return
    submit(current => ({ ...current, page: 1, ...patch, ...appScope }), {
      search: Object.hasOwn(patch, 'search') ? (patch.search ?? '') : undefined
    })
  }

  const resetFilters = () => {
    if (loading) return
    submit(() => ({ ...appScope, page: 1, pageSize: 20, sort: defaultSort }), {
      href: application ? `${basePath}?view=activity` : basePath,
      search: ''
    })
  }

  const exportParams = compactActivityParams({ ...filters, ...appScope, sort: serializeSortParam(sorting) })
  const activeFilters = useMemo(() => activityFilterEntries(filters, facets), [filters, facets])

  return {
    activeFilters,
    exportHref: `/api/activity/export${exportParams.size ? `?${exportParams.toString()}` : ''}`,
    isNavigating,
    localFilters: { ...query, search: searchDraft },
    pushParams,
    resetFilters,
    removeFilter: (key: keyof AuditFilterValues) => {
      if (application && ['resourceType', 'resourceId'].includes(key)) return
      pushParams({ [key]: undefined })
    },
    setFilterValue: (key: keyof AuditFilterValues, value: string | undefined) => pushParams({ [key]: value }),
    setSearchDraft,
    setSorting: (nextSorting: SortingState) => pushParams({ page: 1, sort: serializeSortParam(nextSorting) })
  }
}
