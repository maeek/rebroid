import { describe, expect, it } from 'vitest'
import { platformGridQueryFromSearchParams } from './platform-grid-search'

describe('platformGridQueryFromSearchParams', () => {
  it('normalizes platform grid search params with safe defaults', () => {
    expect(platformGridQueryFromSearchParams({})).toMatchObject({
      page: 1,
      pageSize: 20,
      q: undefined,
      ownership: 'managed',
      sort: undefined
    })
  })

  it('clamps pagination and preserves allowed ownership filters', () => {
    expect(
      platformGridQueryFromSearchParams({
        page: '-2',
        pageSize: '200',
        q: '  redis  ',
        ownership: 'all',
        sort: 'name:asc'
      })
    ).toMatchObject({
      page: 1,
      pageSize: 100,
      q: 'redis',
      ownership: 'all',
      sort: 'name:asc'
    })
  })

  it('uses the first value for repeated search params', () => {
    expect(
      platformGridQueryFromSearchParams({
        page: ['3', '1'],
        pageSize: ['10', '50'],
        ownership: ['unknown', 'all']
      })
    ).toMatchObject({
      page: 3,
      pageSize: 10,
      ownership: 'managed'
    })
  })
})
