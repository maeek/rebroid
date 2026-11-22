import { parseAutomationGridSort } from '@rebroid/automation-core/grid-sort'
import { describe, expect, it } from 'vitest'
import { buildAutomationGridHref } from './grid-query-utils'

describe('grid query utils', () => {
  it('preserves literal searches and tags named all across workflow and trigger pagination', () => {
    for (const path of ['/automations', '/automations/triggers'] as const) {
      const href = buildAutomationGridHref(path, {
        gridQuery: { q: ' all ', tag: 'all', lastRun: 'all' },
        patch: { page: 2 },
        pageSize: 20
      })
      expect(href).toBe(`${path}?q=all&tag=all&page=2&pageSize=20`)
    }
  })

  it('parses sorting search params', () => {
    const sorting = parseAutomationGridSort('updatedAt:desc,name:asc', 'workflows')

    expect(sorting).toEqual([
      { id: 'updatedAt', desc: true },
      { id: 'name', desc: false }
    ])
  })
  it('ignores unsupported columns before applying the three-column limit', () => {
    const sort = 'bogus:asc,createdAt:asc,updatedAt:asc,name:asc,enabled:desc'
    expect(parseAutomationGridSort(sort, 'workflows').map(field => field.id)).toEqual([
      'createdAt',
      'updatedAt',
      'name'
    ])
    expect(parseAutomationGridSort(sort, 'triggers').map(field => field.id)).toEqual(['updatedAt', 'name', 'enabled'])
  })
})
