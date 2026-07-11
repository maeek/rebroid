import { describe, expect, it } from 'vitest'
import {
  deriveAppsListSelection,
  fulfilledBulkDeleteAppIds,
  retainVisibleSelectedIds,
  summarizeBulkDeleteAppsResult,
  summarizeBulkStopAppsResult
} from './apps-list-selection'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = (id: string, overrides: Partial<AppDefinition> = {}): AppDefinition =>
  ({
    id,
    name: id,
    running: false,
    status: 'stopped',
    ownerUserId: 'owner-1',
    ...overrides
  }) as unknown as AppDefinition

describe('apps list selection model', () => {
  it('retains only selected ids still present in visible apps', () => {
    const selectedIds = retainVisibleSelectedIds([app('app-1'), app('app-3')], new Set(['app-1', 'app-2', 'app-3']))

    expect([...selectedIds]).toEqual(['app-1', 'app-3'])
  })

  it('derives bulk action targets from ownership and app status', () => {
    const apps = [
      app('running-owned', { running: true, status: 'running' }),
      app('running-other', {
        running: true,
        status: 'running',
        ownerUserId: 'owner-2'
      }),
      app('removing-owned', {
        running: true,
        status: 'removing',
        ownerUserId: 'owner-1'
      })
    ]
    const selectedIds = new Set(apps.map(item => item.id))

    const stopSelection = deriveAppsListSelection({
      apps,
      selectedIds,
      currentOwnerUserId: 'owner-1',
      bulkAction: 'stop'
    })
    const deleteSelection = deriveAppsListSelection({
      apps,
      selectedIds,
      currentOwnerUserId: 'owner-1',
      bulkAction: 'delete'
    })

    expect(stopSelection.allSelected).toBe(true)
    expect(stopSelection.stoppableSelectedApps.map(item => item.id)).toEqual(['running-owned'])
    expect(stopSelection.activeBulkApps.map(item => item.id)).toEqual(['running-owned'])
    expect(deleteSelection.deletableSelectedApps.map(item => item.id)).toEqual(['running-owned', 'running-other'])
    expect(deleteSelection.activeBulkApps.map(item => item.id)).toEqual(['running-owned', 'running-other'])
  })

  it('extracts fulfilled bulk delete app ids', () => {
    const results = [
      { status: 'fulfilled', value: 'app-1' },
      { status: 'rejected', reason: new Error('failed') },
      { status: 'fulfilled', value: 'app-3' }
    ] satisfies PromiseSettledResult<string>[]

    expect(fulfilledBulkDeleteAppIds(results)).toEqual(['app-1', 'app-3'])
  })

  it('summarizes bulk app stop and delete results', () => {
    const fulfilledResults = [{ status: 'fulfilled', value: undefined }] satisfies PromiseSettledResult<unknown>[]
    const mixedResults = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('failed') }
    ] satisfies PromiseSettledResult<unknown>[]

    expect(summarizeBulkStopAppsResult(fulfilledResults)).toEqual({ title: 'Selected apps stopped' })
    expect(summarizeBulkStopAppsResult(mixedResults)).toEqual({
      title: 'Some apps could not be stopped',
      description: '1 stop request failed.',
      variant: 'danger'
    })
    expect(summarizeBulkDeleteAppsResult(fulfilledResults, ['app-1'])).toEqual({
      title: 'Selected apps deleted'
    })
    expect(summarizeBulkDeleteAppsResult(mixedResults, ['app-1'])).toEqual({
      title: 'Some apps could not be deleted',
      description: '1 delete request failed.',
      variant: 'danger'
    })
  })
})
