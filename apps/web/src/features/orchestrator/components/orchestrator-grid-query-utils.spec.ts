import { describe, expect, it } from '@jest/globals'
import {
  compactPlatformGridParams,
  platformSortFromSearchParam,
  platformSortToSearchParam
} from './orchestrator-grid-query-utils'

describe('orchestrator grid query utils', () => {
  it('omits the default managed scope', () => {
    expect(compactPlatformGridParams({ scope: 'managed', q: 'redroid' }).toString()).toBe('q=redroid')
  })

  it('parses and serializes platform sorting', () => {
    const sorting = platformSortFromSearchParam('name:asc,state:desc')

    expect(sorting).toEqual([
      { id: 'name', desc: false },
      { id: 'state', desc: true }
    ])
    expect(platformSortToSearchParam(sorting)).toBe('name:asc,state:desc')
  })
})
