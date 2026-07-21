import { describe, expect, it } from 'vitest'
import {
  buildPlatformGridHref,
  compactPlatformGridParams,
  platformSortFromSearchParam,
  summarizePlatformBulkRemoveResults
} from './runtime-grid-query-utils'

describe('orchestrator grid query utils', () => {
  it('omits the default managed ownership', () => {
    expect(compactPlatformGridParams({ ownership: 'managed', q: 'redroid' }).toString()).toBe('q=redroid')
  })

  it('builds platform grid hrefs from current query and patch values', () => {
    expect(
      buildPlatformGridHref({
        basePath: '/runtime/images',
        gridQuery: { q: 'redroid', ownership: 'managed', sort: 'createdAt:desc', page: 4, pageSize: 25 },
        pageSize: 25,
        patch: { q: 'base', page: 1 }
      })
    ).toBe('/runtime/images?q=base&sort=createdAt%3Adesc&page=1&pageSize=25')
  })

  it('parses platform sorting', () => {
    const sorting = platformSortFromSearchParam('name:asc,state:desc')

    expect(sorting).toEqual([
      { id: 'name', desc: false },
      { id: 'state', desc: true }
    ])
  })

  it('supports resource-specific sort defaults', () => {
    expect(platformSortFromSearchParam(undefined, { defaultSort: 'createdAt:desc' })).toEqual([
      { id: 'createdAt', desc: true }
    ])
    expect(platformSortFromSearchParam('createdAt', { missingDirection: 'desc' })).toEqual([
      { id: 'createdAt', desc: true }
    ])
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
      variant: 'danger'
    })
  })
})
