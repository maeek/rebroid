import { describe, expect, it } from 'vitest'
import { parseOutboundDestinations } from './outbound-destinations'

describe('IPv4 destination list', () => {
  it('normalizes individual addresses and deduplicates pasted entries', () => {
    expect(parseOutboundDestinations('10.0.0.0/16, 203.0.113.10\n10.0.0.0/16', true)).toEqual({
      cidrs: ['10.0.0.0/16', '203.0.113.10/32']
    })
  })

  it('accepts an empty list', () => {
    expect(parseOutboundDestinations(' \n ', false)).toEqual({ cidrs: [] })
  })

  it('identifies the invalid line', () => {
    expect(parseOutboundDestinations('10.0.0.1\n\n10.0.0.0/24/32', true)).toEqual({
      error: 'Line 3 has an invalid IPv4 address or range (10.0.0.0/24/32).'
    })
  })

  it('requires permission for ranges granting broad internet access', () => {
    expect(parseOutboundDestinations('203.0.0.0/17, 203.0.128.0/17', false).error).toMatch(
      /require internet access permission/
    )
  })
})
