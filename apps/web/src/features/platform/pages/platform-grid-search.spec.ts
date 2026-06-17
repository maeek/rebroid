import { describe, expect, it } from '@jest/globals'
import { platformGridQueryFromSearchParams } from './platform-grid-search'

describe('platformGridQueryFromSearchParams', () => {
  it('normalizes platform grid search params with safe defaults', () => {
    expect(platformGridQueryFromSearchParams({})).toEqual({
      page: 1,
      pageSize: 20,
      q: undefined,
      scope: 'managed',
      sort: undefined
    })
  })

  it('clamps pagination and preserves allowed managed scope filters', () => {
    expect(
      platformGridQueryFromSearchParams({
        page: '-2',
        pageSize: '200',
        q: '  redis  ',
        scope: 'all',
        sort: 'name:asc'
      })
    ).toEqual({
      page: 1,
      pageSize: 100,
      q: 'redis',
      scope: 'all',
      sort: 'name:asc'
    })
  })

  it('uses the first value for repeated search params', () => {
    expect(
      platformGridQueryFromSearchParams({
        page: ['3', '1'],
        pageSize: ['10', '50'],
        scope: ['unknown', 'all']
      })
    ).toMatchObject({
      page: 3,
      pageSize: 10,
      scope: 'managed'
    })
  })
})
