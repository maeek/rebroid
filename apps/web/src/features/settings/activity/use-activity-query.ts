import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { serializeSortParam } from '@/shared/model/search-params'
import { activityFilterEntries, compactActivityParams } from './activity-format'
import type { ActivityEventsTableProps } from './activity-types'
import type { AuditFilterValues } from '@/shared/contracts/audit'
import type { SortingState } from '@tanstack/react-table'

type QueryPatch = Partial<AuditFilterValues> & { page?: number; pageSize?: number; sort?: string }

export const useActivityQuery = ({
  filters,
  sorting,
  result,
  application,
  facets,
  loading
}: ActivityEventsTableProps) => {
  const router = useRouter()
  const [localFilters, setLocalFilters] = useState(filters)
  const [isNavigating, startNavigation] = useTransition()
  const query = useRef({ filters, sort: serializeSortParam(sorting), pageSize: result.pageSize })

  useEffect(() => {
    const submittedSearch = query.current.filters.search
    query.current = { filters, sort: serializeSortParam(sorting), pageSize: result.pageSize }
    setLocalFilters(current => ({
      ...filters,
      search: current.search === submittedSearch ? filters.search : current.search
    }))
  }, [filters, sorting, result.pageSize])

  const basePath = application ? `/app/${encodeURIComponent(application.id)}` : '/security/audit-log'
  const scopeFilters = (values: AuditFilterValues): AuditFilterValues =>
    application ? { ...values, resourceType: 'application', resourceId: application.id } : values

  const pushParams = (patch: QueryPatch) => {
    if (loading) return
    const { page = 1, pageSize = query.current.pageSize, sort, ...filterPatch } = patch
    const next = {
      filters: scopeFilters({ ...query.current.filters, ...filterPatch }),
      sort: Object.hasOwn(patch, 'sort') ? sort : query.current.sort,
      pageSize
    }
    query.current = next
    setLocalFilters(current => ({
      ...next.filters,
      search: Object.hasOwn(filterPatch, 'search') ? next.filters.search : current.search
    }))
    const params = compactActivityParams({ ...next.filters, page, pageSize, sort: next.sort })
    if (application) {
      params.set('view', 'activity')
      params.delete('resourceType')
      params.delete('resourceId')
    }
    startNavigation(() => router.push(`${basePath}?${params.toString()}`))
  }

  const resetFilters = () => {
    if (loading) return
    const nextFilters = scopeFilters({})
    query.current = { filters: nextFilters, pageSize: 20, sort: 'createdAt:desc' }
    setLocalFilters(nextFilters)
    startNavigation(() => router.push(application ? `${basePath}?view=activity` : basePath))
  }

  const exportParams = compactActivityParams({ ...scopeFilters(filters), sort: serializeSortParam(sorting) })
  const activeFilters = useMemo(() => activityFilterEntries(filters, facets), [filters, facets])

  return {
    activeFilters,
    exportHref: `/api/activity/export${exportParams.size ? `?${exportParams.toString()}` : ''}`,
    isNavigating,
    localFilters,
    pushParams,
    resetFilters,
    removeFilter: (key: keyof AuditFilterValues) => {
      if (application && ['resourceType', 'resourceId'].includes(key)) return
      pushParams({ [key]: undefined })
    },
    setFilterValue: (key: keyof AuditFilterValues, value: string | undefined) => pushParams({ [key]: value }),
    setSearchDraft: (search: string) => setLocalFilters(current => ({ ...current, search })),
    setSorting: (nextSorting: SortingState) => pushParams({ page: 1, sort: serializeSortParam(nextSorting) })
  }
}
