import { describe, expect, it } from 'vitest'
import { retainVisibleSelectedIds } from '@/shared/model/visible-selection'
import { buildAutomationGridHref } from '../shared/grid-query-utils'
import type { AutomationGridRow } from '@/shared/contracts/automation'

const automation = (id: string): AutomationGridRow => ({ id, name: id }) as AutomationGridRow

describe('automations table model', () => {
  it('clears workflow filters without restoring their previous values', () => {
    const url = new URL(
      buildAutomationGridHref('/automations', {
        gridQuery: { q: 'smoke', tag: 'nightly', targetDeviceId: 'app-1', status: 'failed', lastRun: '7d' },
        pageSize: 20,
        patch: { tag: undefined, targetDeviceId: undefined, status: undefined, lastRun: undefined, page: 1 }
      }),
      'https://rebroid.test'
    )
    expect([...url.searchParams.keys()]).toEqual(['q', 'page', 'pageSize'])
  })
  it('retains and derives current page selection', () => {
    const automations = [automation('a'), automation('c')]
    const selectedIds = new Set(['a', 'b', 'c'])

    expect([...retainVisibleSelectedIds(automations, selectedIds)]).toEqual(['a', 'c'])
  })

  it('builds compact workflow grid hrefs', () => {
    expect(
      buildAutomationGridHref('/automations', {
        gridQuery: {
          q: 'smoke',
          tag: 'nightly',
          targetDeviceId: 'app-1',
          status: 'failed',
          lastRun: 'all',
          sort: 'updatedAt:desc',
          page: 3,
          pageSize: 25
        },
        pageSize: 25,
        patch: { q: '', page: 1 }
      })
    ).toBe('/automations?tag=nightly&targetDeviceId=app-1&status=failed&sort=updatedAt%3Adesc&page=1&pageSize=25')
  })
})
