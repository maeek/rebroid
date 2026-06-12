import { describe, expect, it } from '@jest/globals'
import { mergeAppsListRefresh } from './apps-list-refresh'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const app = (id: string, overrides: Partial<AppDefinition> = {}): AppDefinition =>
  ({
    id,
    name: id,
    icon: null,
    ownerDisplayName: null,
    status: 'running',
    lifecycleStage: 'running',
    ...overrides
  }) as AppDefinition

describe('apps list refresh model', () => {
  it('preserves local icon and owner labels while filtering hidden removals', () => {
    const currentApps = [
      app('app-1', {
        icon: 'local-icon',
        ownerDisplayName: 'Local owner'
      }),
      app('app-2')
    ]
    const refreshedApps = [
      app('app-1', {
        icon: null,
        ownerDisplayName: 'Remote owner'
      }),
      app('app-2'),
      app('app-3')
    ]

    const result = mergeAppsListRefresh({
      currentApps,
      refreshedApps,
      hiddenRemovingIds: new Set(['app-2']),
      pendingOverrides: new Map(),
      nowMs: 1000
    })

    expect(result.expiredOverrideIds).toEqual([])
    expect(result.apps.map(item => item.id)).toEqual(['app-1', 'app-3'])
    expect(result.apps[0]).toMatchObject({
      id: 'app-1',
      icon: 'local-icon',
      ownerDisplayName: 'Local owner'
    })
  })

  it('uses active optimistic overrides and reports expired override ids', () => {
    const refreshedApps = [app('active'), app('expired')]
    const activeOverride = app('active', {
      status: 'stopped',
      lifecycleStage: 'stopping',
      statusMessage: 'Stopping app.'
    })

    const result = mergeAppsListRefresh({
      currentApps: [],
      refreshedApps,
      hiddenRemovingIds: new Set(),
      pendingOverrides: new Map([
        ['active', { app: activeOverride, expiresAt: 2000 }],
        ['expired', { app: app('expired', { status: 'removing' }), expiresAt: 1000 }]
      ]),
      nowMs: 1500
    })

    expect(result.expiredOverrideIds).toEqual(['expired'])
    expect(result.apps).toEqual([activeOverride, app('expired')])
  })

  it('keeps overrides without an expiry until the controller clears them', () => {
    const override = app('app-1', { status: 'provisioning' })

    const result = mergeAppsListRefresh({
      currentApps: [],
      refreshedApps: [app('app-1', { status: 'running' })],
      hiddenRemovingIds: new Set(),
      pendingOverrides: new Map([['app-1', { app: override, expiresAt: null }]]),
      nowMs: Number.MAX_SAFE_INTEGER
    })

    expect(result.expiredOverrideIds).toEqual([])
    expect(result.apps).toEqual([override])
  })
})
