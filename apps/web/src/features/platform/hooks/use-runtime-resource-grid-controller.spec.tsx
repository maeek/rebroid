import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPlatformGridHref } from '../components/runtime-grid-query-utils'
import { useRuntimeResourceGridController } from './use-runtime-resource-grid-controller'

const replace = vi.fn<(href: string, options: { scroll: boolean }) => void>()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace })
}))

const getItemId = (item: { id: string }) => item.id
const parseSort = (sort: string | undefined) => [
  { id: sort?.split(':')[0] ?? 'name', desc: sort?.endsWith(':desc') ?? false }
]
type GridQuery = { q?: string; state?: string; page?: number; pageSize?: number; sort?: string; ownership?: string }
const buildHref = (input: { gridQuery: GridQuery; patch: Partial<GridQuery>; pageSize: number }) =>
  buildPlatformGridHref({ basePath: '/runtime/items', ...input })
const requestedParams = () => new URL(replace.mock.lastCall![0], 'https://example.test').searchParams

describe('useRuntimeResourceGridController', () => {
  beforeEach(() => replace.mockClear())

  it('updates search, sorting, and pagination through one href builder', () => {
    const { result } = renderHook(() =>
      useRuntimeResourceGridController({
        items: [{ id: 'a' }],
        gridQuery: { q: '', sort: 'name:asc' },
        pageSize: 20,
        getItemId,
        parseSort,
        buildHref
      })
    )

    act(() => result.current.onSearch(' redroid '))
    act(() => result.current.onSortingChange([{ id: 'state', desc: true }]))
    act(() => result.current.onPageIndexChange(2))
    act(() => result.current.onPageSizeChange(50))

    expect(Object.fromEntries(requestedParams())).toEqual({
      q: 'redroid',
      sort: 'state:desc',
      page: '1',
      pageSize: '50'
    })
    expect(replace).toHaveBeenCalledTimes(4)
    expect(new URL(replace.mock.calls[2][0], 'https://example.test').searchParams.get('page')).toBe('3')
  })

  it('merges rapid edits and preserves explicit clears after an earlier response', () => {
    const initialProps: GridQuery = { q: 'current', ownership: 'managed', page: 3 }
    const { result, rerender } = renderHook(
      (gridQuery: GridQuery) =>
        useRuntimeResourceGridController({ items: [], gridQuery, pageSize: 20, getItemId, parseSort, buildHref }),
      { initialProps }
    )

    act(() => {
      result.current.pushGridParams({ ownership: 'all', page: 1 })
      result.current.pushGridParams({ state: 'running', page: 1 })
    })
    expect(Object.fromEntries(requestedParams())).toMatchObject({ ownership: 'all', state: 'running', page: '1' })
    rerender({ ...initialProps, ownership: 'all', page: 1 })
    expect(result.current.query.state).toBe('running')

    act(() => result.current.onSearch(''))
    expect(requestedParams().has('q')).toBe(false)
    expect(Object.fromEntries(requestedParams())).toMatchObject({ ownership: 'all', state: 'running', page: '1' })
  })

  it('retains newer search text after a response and clears pending edits on browser Back', () => {
    const initialProps: GridQuery = { q: 'previous', page: 1 }
    const { result, rerender } = renderHook(
      (gridQuery: GridQuery) =>
        useRuntimeResourceGridController({ items: [], gridQuery, pageSize: 20, getItemId, parseSort, buildHref }),
      { initialProps }
    )

    act(() => {
      result.current.onSearch('new')
      result.current.setSearch('new draft')
    })
    rerender({ q: 'new', page: 1 })
    expect(result.current.search).toBe('new draft')

    act(() => result.current.pushGridParams({ state: 'running' }))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    rerender(initialProps)
    expect(result.current.search).toBe('previous')
    act(() => result.current.onPageIndexChange(1))
    expect(Object.fromEntries(requestedParams())).toEqual({ q: 'previous', page: '2', pageSize: '20' })
  })

  it('resolves selected items and prunes selections that leave the page', () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useRuntimeResourceGridController({
          items,
          gridQuery: {},
          pageSize: 20,
          getItemId,
          parseSort,
          buildHref
        }),
      { initialProps: { items: [{ id: 'a' }, { id: 'b' }] } }
    )

    act(() => result.current.setSelectedIds(new Set(['a', 'b'])))
    expect(result.current.selectedItems).toEqual([{ id: 'a' }, { id: 'b' }])

    rerender({ items: [{ id: 'b' }, { id: 'c' }] })
    expect([...result.current.selectedIds]).toEqual(['b'])
    expect(result.current.selectedItems).toEqual([{ id: 'b' }])
  })
})
