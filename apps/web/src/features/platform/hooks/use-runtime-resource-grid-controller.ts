'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { serializeSortParam } from '@/shared/model/search-params'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'

interface RuntimeResourceGridQuery {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
}

interface RuntimeResourceGridHrefInput<TQuery extends RuntimeResourceGridQuery> {
  gridQuery: TQuery
  pageSize: number
  patch: Partial<TQuery>
}

export const useRuntimeResourceGridController = <TItem, TQuery extends RuntimeResourceGridQuery>({
  items,
  gridQuery,
  pageSize,
  getItemId,
  parseSort,
  buildHref
}: {
  items: TItem[]
  gridQuery: TQuery
  pageSize: number
  getItemId: (item: TItem) => string
  parseSort: (sort: string | undefined) => SortingState
  buildHref: (input: RuntimeResourceGridHrefInput<TQuery>) => string
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const sorting = useMemo(() => parseSort(gridQuery.sort), [gridQuery.sort, parseSort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    const visibleIds = new Set(items.map(getItemId))
    setSelectedIds(current => {
      const visibleSelection = new Set([...current].filter(id => visibleIds.has(id)))
      return visibleSelection.size === current.size ? current : visibleSelection
    })
  }, [getItemId, items])

  const selectedItems = items.filter(item => selectedIds.has(getItemId(item)))
  const pushGridParams = (patch: Partial<TQuery>) => {
    router.replace(buildHref({ gridQuery, pageSize, patch }), { scroll: false })
  }
  const onSortingChange: OnChangeFn<SortingState> = updater => {
    const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
    pushGridParams({ sort: serializeSortParam(nextSorting), page: 1 } as Partial<TQuery>)
  }

  return {
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    selectedItems,
    sorting,
    pushGridParams,
    onSearch: (value: string) => pushGridParams({ q: value.trim() || undefined, page: 1 } as Partial<TQuery>),
    onSortingChange,
    onPageIndexChange: (pageIndex: number) => pushGridParams({ page: pageIndex + 1 } as Partial<TQuery>),
    onPageSizeChange: (nextPageSize: number) => pushGridParams({ page: 1, pageSize: nextPageSize } as Partial<TQuery>),
    clearSelection: () => setSelectedIds(new Set()),
    refresh: () => router.refresh()
  }
}
