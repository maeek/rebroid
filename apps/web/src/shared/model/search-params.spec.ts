import { describe, expect, it } from 'vitest'
import {
  firstSearchParamValue,
  positiveIntegerSearchParam,
  serializeSortParam,
  validatedSearchParam
} from './search-params'

describe('search parameter helpers', () => {
  it.each([
    [undefined, undefined],
    ['value', 'value'],
    [['first', 'second'], 'first'],
    [[], undefined]
  ])('extracts the first scalar from %j', (input, expected) => {
    expect(firstSearchParamValue(input)).toBe(expected)
  })

  it.each([
    [undefined, 20],
    ['9', 9],
    [['7', '8'], 7],
    ['invalid', 20],
    ['-4', 20],
    ['1.8', 1],
    ['1000', 100]
  ])('normalizes bounded positive integer %j', (input, expected) => {
    expect(positiveIntegerSearchParam(input, { fallback: 20, max: 100 })).toBe(expected)
  })

  it('accepts only allowlisted scalar values', () => {
    const allowed = new Set(['name:asc', 'updatedAt:desc'])
    expect(validatedSearchParam('name:asc', allowed)).toBe('name:asc')
    expect(validatedSearchParam('unknown:desc', allowed)).toBeUndefined()
  })

  it('serializes sort state and omits empty sorting', () => {
    expect(serializeSortParam([])).toBeUndefined()
    expect(
      serializeSortParam([
        { id: 'name', desc: false },
        { id: 'updatedAt', desc: true }
      ])
    ).toBe('name:asc,updatedAt:desc')
  })
})
