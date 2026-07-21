import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRuntimeResourceGridController } from './use-runtime-resource-grid-controller'

const replace = vi.fn<(href: string, options: { scroll: boolean }) => void>()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace })
}))

const getItemId = (item: { id: string }) => item.id
const parseSort = (sort: string | undefined) => [
  { id: sort?.split(':')[0] ?? 'name', desc: sort?.endsWith(':desc') ?? false }
]
const buildHref = ({ patch }: { patch: Record<string, unknown> }) =>
  `/runtime/items?${new URLSearchParams(Object.entries(patch).map(([key, value]) => [key, String(value)])).toString()}`

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

    expect(replace.mock.calls.map(([href]) => href)).toEqual([
      '/runtime/items?q=redroid&page=1',
      '/runtime/items?sort=state%3Adesc&page=1',
      '/runtime/items?page=3',
      '/runtime/items?page=1&pageSize=50'
    ])
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
