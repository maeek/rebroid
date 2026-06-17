import { describe, expect, it } from '@jest/globals'
import {
  buildPlatformGridHref,
  compactPlatformGridParams,
  platformSortFromSearchParam,
  platformSortToSearchParam,
  retainVisiblePlatformSelection,
  selectedPlatformItemsFromIds,
  summarizePlatformBulkRemoveResults
} from './runtime-grid-query-utils'

describe('orchestrator grid query utils', () => {
  it('omits the default managed scope', () => {
    expect(compactPlatformGridParams({ scope: 'managed', q: 'redroid' }).toString()).toBe('q=redroid')
  })

  it('builds platform grid hrefs from current query and patch values', () => {
    expect(
      buildPlatformGridHref({
        basePath: '/runtime/images',
        gridQuery: { q: 'redroid', scope: 'managed', sort: 'createdAt:desc', page: 4, pageSize: 25 },
        pageSize: 25,
        patch: { q: 'base', page: 1 }
      })
    ).toBe('/runtime/images?q=base&sort=createdAt%3Adesc&page=1&pageSize=25')
  })

  it('parses and serializes platform sorting', () => {
    const sorting = platformSortFromSearchParam('name:asc,state:desc')

    expect(sorting).toEqual([
      { id: 'name', desc: false },
      { id: 'state', desc: true }
    ])
    expect(platformSortToSearchParam(sorting)).toBe('name:asc,state:desc')
  })

  it('supports resource-specific sort defaults', () => {
    expect(platformSortFromSearchParam(undefined, { defaultSort: 'createdAt:desc' })).toEqual([
      { id: 'createdAt', desc: true }
    ])
    expect(platformSortFromSearchParam('createdAt', { missingDirection: 'desc' })).toEqual([
      { id: 'createdAt', desc: true }
    ])
  })

  it('retains and derives visible platform selections', () => {
    const items = [{ id: 'a' }, { id: 'c' }]
    const selectedIds = new Set(['a', 'b', 'c'])

    expect([...retainVisiblePlatformSelection(items, selectedIds)]).toEqual(['a', 'c'])
    expect(selectedPlatformItemsFromIds(items, selectedIds)).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('summarizes platform bulk remove results', () => {
    expect(summarizePlatformBulkRemoveResults([{ status: 'fulfilled', value: undefined }], 'image')).toEqual({
      title: 'Selected images removed'
    })
    expect(
      summarizePlatformBulkRemoveResults([{ status: 'rejected', reason: new Error('failed') }], 'network')
    ).toEqual({
      title: 'Some networks could not be removed',
      description: '1 remove request failed.',
      variant: 'destructive'
    })
  })
})
