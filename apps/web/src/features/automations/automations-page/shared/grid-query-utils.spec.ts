import { describe, expect, it } from 'vitest'
import { allFilterValue, compactGridParams, sortFromSearchParam, sortToSearchParam } from './grid-query-utils'

describe('grid query utils', () => {
  it('drops empty and all filter values', () => {
    const params = compactGridParams({ q: ' apps ', tag: allFilterValue, page: 2, status: undefined })

    expect(params.toString()).toBe('q=apps&page=2')
  })

  it('round-trips sorting search params', () => {
    const sorting = sortFromSearchParam('updatedAt:desc,name:asc')

    expect(sorting).toEqual([
      { id: 'updatedAt', desc: true },
      { id: 'name', desc: false }
    ])
    expect(sortToSearchParam(sorting)).toBe('updatedAt:desc,name:asc')
  })
})
