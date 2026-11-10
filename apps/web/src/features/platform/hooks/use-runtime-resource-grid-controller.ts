'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { serializeSortParam } from '@/shared/model/search-params'
import { useRoutedGridQuery } from '@/shared/ui/data-grid/use-routed-grid-query'
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
  const { query, searchDraft, setSearchDraft, submit } = useRoutedGridQuery({
    committedQuery: gridQuery,
    hrefFor: next => buildHref({ gridQuery: next, pageSize, patch: {} }),
    searchFrom: next => next.q,
    navigate: href => router.replace(href, { scroll: false })
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const sorting = useMemo(() => parseSort(gridQuery.sort), [gridQuery.sort, parseSort])

  useEffect(() => {
    const visibleIds = new Set(items.map(getItemId))
    setSelectedIds(current => {
      const visibleSelection = new Set([...current].filter(id => visibleIds.has(id)))
      return visibleSelection.size === current.size ? current : visibleSelection
    })
  }, [getItemId, items])

  const selectedItems = items.filter(item => selectedIds.has(getItemId(item)))
  const pushGridParams = (patch: Partial<TQuery>) => submit(current => ({ ...current, ...patch }))
  const onSortingChange: OnChangeFn<SortingState> = updater => {
    submit(current => ({
      ...current,
      sort: serializeSortParam(typeof updater === 'function' ? updater(parseSort(current.sort)) : updater),
      page: 1
    }))
  }

  return {
    search: searchDraft,
    setSearch: setSearchDraft,
    query,
    selectedIds,
    setSelectedIds,
    selectedItems,
    sorting,
    pushGridParams,
    onSearch: (value: string) =>
      submit(current => ({ ...current, q: value.trim() || undefined, page: 1 }), { search: value }),
    onSortingChange,
    onPageIndexChange: (pageIndex: number) => pushGridParams({ page: pageIndex + 1 } as Partial<TQuery>),
    onPageSizeChange: (nextPageSize: number) => pushGridParams({ page: 1, pageSize: nextPageSize } as Partial<TQuery>),
    clearSelection: () => setSelectedIds(new Set()),
    refresh: () => router.refresh()
  }
}
