import { describe, expect, it } from 'vitest'
import { parsePlatformInventorySort } from './platform-inventory-sort'

const nameAscending = { id: 'name', desc: false }
const newestFirst = { id: 'createdAt', desc: true }

describe('platform inventory sort', () => {
  it('uses each resource’s default fields and directions', () => {
    expect(parsePlatformInventorySort('containers', undefined)).toEqual([nameAscending])
    expect(parsePlatformInventorySort('networks', undefined)).toEqual([nameAscending])
    expect(parsePlatformInventorySort('images', undefined)).toEqual([newestFirst])
    expect(parsePlatformInventorySort('images', 'createdAt')).toEqual([newestFirst])
    expect(parsePlatformInventorySort('images', 'sizeBytes:bogus')).toEqual([{ id: 'sizeBytes', desc: true }])
  })

  it('filters unsupported fields before limiting the sort to three columns', () => {
    expect(
      parsePlatformInventorySort('containers', 'sizeBytes,driver,scope,name:asc,state:desc,image,applicationId')
    ).toEqual([nameAscending, { id: 'state', desc: true }, { id: 'image', desc: false }])
  })
})
