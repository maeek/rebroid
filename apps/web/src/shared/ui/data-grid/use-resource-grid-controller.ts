'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { serializeSortParam } from '@/shared/model/search-params'
import { retainVisibleSelectedIds } from '@/shared/model/visible-selection'
import { useRoutedGridQuery } from '@/shared/ui/data-grid/use-routed-grid-query'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'

interface ResourceGridQuery {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
}

interface ResourceGridHrefInput<TQuery extends ResourceGridQuery> {
  gridQuery: TQuery
  pageSize: number
  patch: Partial<TQuery>
}

export const useResourceGridController = <TItem extends { id: string }, TQuery extends ResourceGridQuery>({
  items,
  gridQuery,
  pageSize,
  parseSort,
  buildHref,
  history = 'replace'
}: {
  items: TItem[]
  gridQuery: TQuery
  pageSize: number
  parseSort: (sort: string | undefined) => SortingState
  history?: 'replace' | 'push'
  buildHref: (input: ResourceGridHrefInput<TQuery>) => string
}) => {
  const router = useRouter()
  const { query, searchDraft, setSearchDraft, isNavigating, submit } = useRoutedGridQuery({
    committedQuery: gridQuery,
    hrefFor: next => buildHref({ gridQuery: next, pageSize, patch: {} }),
    searchFrom: next => next.q,
    navigate: href => (history === 'push' ? router.push(href) : router.replace(href, { scroll: false }))
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const sorting = useMemo(() => parseSort(query.sort), [query.sort, parseSort])

  useEffect(() => {
    setSelectedIds(current => retainVisibleSelectedIds(items, current))
  }, [items])

  const selectedItems = items.filter(item => selectedIds.has(item.id))
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
    isNavigating,
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
    deselectItems: (ids: ReadonlySet<string>) =>
      setSelectedIds(current => new Set([...current].filter(id => !ids.has(id)))),
    refresh: () => router.refresh()
  }
}
