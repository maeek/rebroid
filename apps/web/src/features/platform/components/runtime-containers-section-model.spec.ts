import { describe, expect, it } from '@jest/globals'
import {
  buildContainersGridHref,
  canRunBulkContainerAction,
  selectVisibleOrphanedContainerIds,
  shouldStopContainerInBulkAction,
  summarizeContainerBulkActionResults
} from './runtime-containers-section-model'
import type { PlatformContainer } from '@/server/orchestrator/platform/types'

const container = (overrides: Partial<PlatformContainer> = {}): PlatformContainer =>
  ({
    id: 'container-1',
    shortId: 'abc123',
    names: ['rebroid-app'],
    image: 'redroid',
    imageId: 'image-1',
    state: 'running',
    status: 'Up',
    createdAt: '2026-01-01T00:00:00.000Z',
    managed: true,
    orphaned: false,
    applicationId: 'app-1',
    ports: [],
    networks: [],
    ...overrides
  }) as PlatformContainer

describe('orchestrator containers section model', () => {
  it('builds compact container grid hrefs', () => {
    expect(
      buildContainersGridHref({
        gridQuery: { q: 'app', scope: 'managed', sort: 'name:asc', page: 3, pageSize: 25 },
        pageSize: 25,
        patch: { scope: 'all', page: 1 }
      })
    ).toBe('/runtime/containers?q=app&scope=all&sort=name%3Aasc&page=1&pageSize=25')
  })

  it('allows bulk actions only with at least one selected container', () => {
    expect(canRunBulkContainerAction([])).toBe(false)
    expect(canRunBulkContainerAction([container()])).toBe(true)
  })

  it('stops only running containers during stop bulk actions', () => {
    expect(shouldStopContainerInBulkAction(container({ state: 'running' }))).toBe(true)
    expect(shouldStopContainerInBulkAction(container({ state: 'exited' }))).toBe(false)
  })

  it('adds visible orphaned containers to the current selection', () => {
    const selectedIds = selectVisibleOrphanedContainerIds(
      [container({ id: 'a', orphaned: true }), container({ id: 'b', orphaned: false })],
      new Set(['existing'])
    )

    expect([...selectedIds]).toEqual(['existing', 'a'])
  })

  it('summarizes stop and remove bulk action results', () => {
    expect(summarizeContainerBulkActionResults([{ status: 'fulfilled', value: undefined }], 'stop')).toEqual({
      title: 'Selected containers stopped'
    })
    expect(
      summarizeContainerBulkActionResults(
        [
          { status: 'fulfilled', value: undefined },
          { status: 'rejected', reason: new Error('failed') }
        ],
        'remove'
      )
    ).toEqual({
      title: 'Some containers could not be removed',
      description: '1 request failed.',
      variant: 'destructive'
    })
  })
})
