import { describe, expect, it } from 'vitest'
import {
  buildNetworksGridHref,
  canRemoveSelectedNetworks,
  networkHasAttachedContainers,
  summarizeNetworkRemoveResults
} from './runtime-networks-section-model'
import type { PlatformNetwork } from '@/server/orchestrator/platform/types'

const network = (overrides: Partial<PlatformNetwork> = {}): PlatformNetwork =>
  ({
    id: 'net-1',
    name: 'rebroid-net',
    shortId: 'abc123',
    driver: 'bridge',
    scope: 'local',
    managed: true,
    internal: false,
    subnets: [],
    gateways: [],
    containers: [],
    ...overrides
  }) as PlatformNetwork

describe('orchestrator networks section model', () => {
  it('builds compact hrefs from existing grid query plus patch values', () => {
    expect(
      buildNetworksGridHref({
        gridQuery: { q: 'redroid', ownership: 'managed', sort: 'name:asc', page: 3, pageSize: 25 },
        pageSize: 25,
        patch: { q: 'infra', page: 1 }
      })
    ).toBe('/runtime/networks?q=infra&sort=name%3Aasc&page=1&pageSize=25')
  })

  it('omits default managed ownership and empty query values', () => {
    expect(
      buildNetworksGridHref({
        gridQuery: { ownership: 'managed' },
        pageSize: 50,
        patch: { q: undefined, page: 1 }
      })
    ).toBe('/runtime/networks?page=1&pageSize=50')
  })

  it('detects attached containers before danger network removal', () => {
    expect(networkHasAttachedContainers(network())).toBe(false)
    expect(networkHasAttachedContainers(network({ containers: ['container-1'] }))).toBe(true)
  })

  it('allows bulk removal only when every selected network is detached', () => {
    expect(canRemoveSelectedNetworks([])).toBe(false)
    expect(canRemoveSelectedNetworks([network(), network({ id: 'net-2' })])).toBe(true)
    expect(canRemoveSelectedNetworks([network(), network({ id: 'net-2', containers: ['container-1'] })])).toBe(false)
  })

  it('summarizes bulk remove results for toast feedback', () => {
    expect(summarizeNetworkRemoveResults([{ status: 'fulfilled', value: undefined }])).toEqual({
      title: 'Selected networks removed'
    })
    expect(
      summarizeNetworkRemoveResults([
        { status: 'rejected', reason: new Error('failed') },
        { status: 'rejected', reason: new Error('failed again') }
      ])
    ).toEqual({
      title: 'Some networks could not be removed',
      description: '2 remove requests failed.',
      variant: 'danger'
    })
  })
})
