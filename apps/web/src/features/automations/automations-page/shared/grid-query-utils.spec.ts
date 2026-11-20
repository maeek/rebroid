import { parseAutomationGridSort } from '@rebroid/automation-core/grid-sort'
import { describe, expect, it } from 'vitest'
import { allFilterValue, compactGridParams } from './grid-query-utils'

describe('grid query utils', () => {
  it('drops empty and all filter values', () => {
    const params = compactGridParams({ q: ' apps ', tag: allFilterValue, page: 2, status: undefined })

    expect(params.toString()).toBe('q=apps&page=2')
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
