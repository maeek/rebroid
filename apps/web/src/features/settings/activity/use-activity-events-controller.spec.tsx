import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActivityEventsController } from './use-activity-events-controller'
import type { ActivityEventsTableProps } from './activity-types'

const { push } = vi.hoisted(() => ({ push: vi.fn<(url: string) => void>() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/server/audit/actions', () => ({ purgeAllAuditEventsAction: vi.fn(), saveAuditRetentionAction: vi.fn() }))
const props: ActivityEventsTableProps = {
  application: { id: 'app-1', name: 'Example' },
  result: { events: [], total: 0, page: 1, pageSize: 20, summary: { success: 0, failure: 0, lastEventAt: null } },
  filters: { resourceType: 'application', resourceId: 'app-1', search: 'failed' },
  sorting: [{ id: 'createdAt', desc: true }],
  facets: { actors: [], categories: [], actions: [], resourceTypes: [] },
  auditRetentionDays: 30
}
beforeEach(() => push.mockClear())
describe('embedded application activity navigation', () => {
  it('keeps search, sorting, pagination, and reset on the app activity tab', () => {
    const { result } = renderHook(() => useActivityEventsController(props))
    act(() => result.current.setFilterValue('search', 'start'))
    expect(push).toHaveBeenLastCalledWith(expect.stringMatching(/^\/app\/app-1\?.*view=activity/))
    act(() => result.current.pushParams({ page: 2 }))
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('page=2'))
    act(() => result.current.setSorting([{ id: 'action', desc: false }]))
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining('sort=action%3Aasc'))
    act(() => result.current.resetFilters())
    expect(push).toHaveBeenLastCalledWith('/app/app-1?view=activity')
  })
  it('preserves global audit navigation outside an app', () => {
    const globalProps = { ...props, application: undefined, filters: {} }
    const { result } = renderHook(() => useActivityEventsController(globalProps))
    act(() => result.current.resetFilters())
    expect(push).toHaveBeenLastCalledWith('/security/audit-log')
  })
  it('keeps export scoped to this app', () => {
    const { result } = renderHook(() => useActivityEventsController(props))
    const url = new URL(result.current.exportHref, 'https://example.test')
    expect(url.searchParams.get('resourceId')).toBe('app-1')
    expect(url.searchParams.get('resourceType')).toBe('application')
    expect(url.searchParams.get('search')).toBe('failed')
    expect(url.searchParams.get('sort')).toBe('createdAt:desc')
  })

  it('merges rapid filter, sort, and pagination changes before new server props arrive', () => {
    const { result } = renderHook(() => useActivityEventsController({ ...props, application: undefined }))
    act(() => {
      result.current.setFilterValue('actor', 'admin')
      result.current.setFilterValue('outcome', 'failure')
      result.current.setFilterValue('search', 'start')
      result.current.setSorting([{ id: 'action', desc: false }])
      result.current.pushParams({ page: 2, pageSize: 10 })
    })
    const url = new URL(push.mock.lastCall![0], 'https://example.test')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      actor: 'admin',
      outcome: 'failure',
      search: 'start',
      sort: 'action:asc',
      page: '2',
      pageSize: '10'
    })
    act(() => result.current.removeFilter('actor'))
    const cleared = new URL(push.mock.lastCall![0], 'https://example.test')
    expect(cleared.searchParams.has('actor')).toBe(false)
    expect(cleared.searchParams.get('outcome')).toBe('failure')
    expect(cleared.searchParams.get('sort')).toBe('action:asc')
    expect(cleared.searchParams.get('page')).toBe('1')
  })

  it('retains newer search drafts when the previous search response arrives', () => {
    const { result, rerender } = renderHook((value: ActivityEventsTableProps) => useActivityEventsController(value), {
      initialProps: props
    })
    act(() => result.current.setFilterValue('search', 'start'))
    act(() => result.current.setSearchDraft('start application'))
    rerender({ ...props, filters: { ...props.filters, search: 'start' } })
    expect(result.current.localFilters.search).toBe('start application')
  })

  it('uses the current history entry after Back without replaying a pending filter', () => {
    const { result, rerender } = renderHook((value: ActivityEventsTableProps) => useActivityEventsController(value), {
      initialProps: props
    })
    act(() => result.current.setFilterValue('search', 'start'))
    rerender({ ...props, filters: { ...props.filters, search: 'start' } })
    act(() => result.current.setFilterValue('outcome', 'failure'))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    rerender(props)

    expect(result.current.localFilters.search).toBe('failed')
    act(() => result.current.setFilterValue('actor', 'admin'))
    const params = new URL(push.mock.lastCall![0], 'https://example.test').searchParams
    expect(Object.fromEntries(params)).toMatchObject({ actor: 'admin', search: 'failed', view: 'activity' })
    expect(params.has('outcome')).toBe(false)
    expect(params.has('resourceId')).toBe(false)
    expect(result.current.exportHref).toContain('resourceId=app-1')
  })

  it('keeps newer search text when the server clamps a requested page', () => {
    const { result, rerender } = renderHook((value: ActivityEventsTableProps) => useActivityEventsController(value), {
      initialProps: props
    })
    const originalUrl = window.location.href
    try {
      act(() => {
        result.current.pushParams({ page: 10 })
        result.current.setSearchDraft('start application')
      })
      window.history.replaceState(null, '', push.mock.lastCall![0])
      rerender({ ...props, result: { ...props.result, page: 3 } })
      expect(result.current.localFilters.search).toBe('start application')
    } finally {
      window.history.replaceState(null, '', originalUrl)
    }
  })

  it('resets scope and query intent before another filter change', () => {
    const { result } = renderHook(() => useActivityEventsController(props))
    act(() => {
      result.current.setFilterValue('outcome', 'failure')
      result.current.resetFilters()
      result.current.setFilterValue('actor', 'admin')
      result.current.setFilterValue('resourceId', 'other-app')
    })
    const url = new URL(push.mock.lastCall![0], 'https://example.test')
    expect(url.pathname).toBe('/app/app-1')
    expect(url.searchParams.get('view')).toBe('activity')
    expect(url.searchParams.get('actor')).toBe('admin')
    expect(url.searchParams.has('outcome')).toBe(false)
    expect(url.searchParams.has('resourceId')).toBe(false)
    expect(result.current.localFilters.resourceId).toBe('app-1')
  })
})
