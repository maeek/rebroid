import { describe, expect, it } from 'vitest'
import { retainVisibleSelectedIds } from '@/shared/model/visible-selection'
import { buildAutomationGridHref } from '../shared/grid-query-utils'
import { deletedAutomationIdsFromResults, summarizeAutomationDeleteResults } from './automations-table-model'
import type { AutomationGridRow } from '@/shared/contracts/automation'

const automation = (id: string): AutomationGridRow => ({ id, name: id }) as AutomationGridRow

describe('automations table model', () => {
  it('clears workflow filters without restoring their previous values', () => {
    const url = new URL(
      buildAutomationGridHref('/automations', {
        gridQuery: { q: 'smoke', tag: 'nightly', targetApplicationId: 'app-1', status: 'failed', lastRun: '7d' },
        pageSize: 20,
        patch: { tag: undefined, targetApplicationId: undefined, status: undefined, lastRun: undefined, page: 1 }
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

  it('extracts fulfilled delete ids', () => {
    expect([
      ...deletedAutomationIdsFromResults(
        [automation('a'), automation('b')],
        [
          { status: 'fulfilled', value: undefined },
          { status: 'rejected', reason: new Error('failed') }
        ]
      )
    ]).toEqual(['a'])
  })

  it('builds compact workflow grid hrefs', () => {
    expect(
      buildAutomationGridHref('/automations', {
        gridQuery: {
          q: 'smoke',
          tag: 'nightly',
          targetApplicationId: 'app-1',
          status: 'failed',
          lastRun: 'all',
          sort: 'updatedAt:desc',
          page: 3,
          pageSize: 25
        },
        pageSize: 25,
        patch: { q: '', page: 1 }
      })
    ).toBe('/automations?tag=nightly&targetApplicationId=app-1&status=failed&sort=updatedAt%3Adesc&page=1&pageSize=25')
  })

  it('summarizes workflow delete results', () => {
    const fulfilledResults = [{ status: 'fulfilled', value: undefined }] satisfies PromiseSettledResult<unknown>[]
    const mixedResults = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('failed') }
    ] satisfies PromiseSettledResult<unknown>[]

    expect(summarizeAutomationDeleteResults([automation('a')], new Set(['a']), fulfilledResults)).toEqual({
      title: 'Workflow deleted'
    })
    expect(
      summarizeAutomationDeleteResults([automation('a'), automation('b')], new Set(['a', 'b']), [
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined }
      ])
    ).toEqual({ title: 'Selected workflows deleted' })
    expect(summarizeAutomationDeleteResults([automation('a'), automation('b')], new Set(['a']), mixedResults)).toEqual({
      title: 'Some workflows could not be deleted',
      description: '1 delete request failed.',
      variant: 'danger'
    })
  })
})
