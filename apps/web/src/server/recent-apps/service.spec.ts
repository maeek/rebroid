import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { listRecentlyOpenedApps, listVisibleRecentApps } from './service'
import { listDismissedRecentAppIds, listStoredRecentApps } from './store'
import type { AndroidApplicationSummary } from '@/shared/contracts/application'

vi.mock('@/server/app-icons/store', () => ({ getStoredAppIcon: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { listApplicationSummaries: vi.fn() }
}))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/users/owner-display-names', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/users/owner-display-names')>()),
  getVisibleOwnerDisplayNames: vi.fn()
}))
vi.mock('./store', () => ({ listStoredRecentApps: vi.fn(), listDismissedRecentAppIds: vi.fn() }))

const summary = (id: string, currentStatus: AndroidApplicationSummary['currentStatus'] = 'stopped') =>
  ({ id, name: `App ${id}`, currentStatus, detail: null }) as AndroidApplicationSummary

beforeEach(() => {
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: 'signed-in-user',
    isPlatformAdmin: false,
    permissions: {},
    quotas: {}
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
  vi.mocked(getStoredAppIcon).mockResolvedValue(null)
  vi.mocked(listDismissedRecentAppIds).mockReturnValue(new Set())
  vi.mocked(getVisibleOwnerDisplayNames).mockResolvedValue(new Map())
  vi.mocked(listStoredRecentApps).mockReturnValue([
    { id: 'older', openedAt: 100 },
    { id: 'inaccessible', openedAt: 400 },
    { id: 'newest', openedAt: 300 }
  ])
  vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockResolvedValue([
    summary('older'),
    summary('newest'),
    summary('unvisited', 'running')
  ])
})

describe('authorized recent application reads', () => {
  it('authenticates before reading history, application metadata, or icons', async () => {
    vi.mocked(getCurrentUserContext).mockRejectedValue(new Error('Unauthorized'))

    await expect(listRecentlyOpenedApps()).rejects.toThrow('Unauthorized')

    expect(listStoredRecentApps).not.toHaveBeenCalled()
    expect(orchestratorAppCatalogClient.listApplicationSummaries).not.toHaveBeenCalled()
    expect(getStoredAppIcon).not.toHaveBeenCalled()
  })

  it('uses the signed-in owner scope and only enriches visible visited applications', async () => {
    const apps = await listRecentlyOpenedApps()

    expect(listStoredRecentApps).toHaveBeenCalledWith('signed-in-user')
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenCalledExactlyOnceWith('signed-in-user', {
      applicationIds: ['older', 'inaccessible', 'newest'],
      includeRunning: false
    })
    expect(apps.map(app => app.id)).toEqual(['newest', 'older'])
    expect(vi.mocked(getStoredAppIcon).mock.calls.map(([id]) => id)).toEqual(['newest', 'older'])
  })

  it('skips the upstream inventory when there are no recent visits', async () => {
    vi.mocked(listStoredRecentApps).mockReturnValue([])

    await expect(listRecentlyOpenedApps()).resolves.toEqual([])

    expect(orchestratorAppCatalogClient.listApplicationSummaries).not.toHaveBeenCalled()
    expect(getVisibleOwnerDisplayNames).not.toHaveBeenCalled()
  })

  it('provides gallery ownership and clone access for other owners in personal visit order', async () => {
    const user = await getCurrentUserContext()
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      isPlatformAdmin: true,
      permissions: { 'applications:create': true }
    })
    vi.mocked(getVisibleOwnerDisplayNames).mockResolvedValue(new Map([['another-user', 'Operations']]))
    vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockResolvedValue([
      { ...summary('older'), ownerUserId: 'signed-in-user' },
      { ...summary('newest', 'error'), ownerUserId: 'another-user' },
      summary('unvisited', 'running')
    ])

    expect(await listRecentlyOpenedApps()).toMatchObject([
      { id: 'newest', ownerDisplayName: 'Operations', canClone: true, canStart: false, statusLabel: 'Error' },
      { id: 'older', ownerDisplayName: null, canClone: false }
    ])
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenCalledWith(undefined, {
      applicationIds: ['older', 'inaccessible', 'newest'],
      includeRunning: false
    })
    expect(getVisibleOwnerDisplayNames).toHaveBeenCalledWith(expect.objectContaining({ isPlatformAdmin: true }), [
      'another-user'
    ])
    expect(listStoredRecentApps).toHaveBeenCalledWith('signed-in-user')
  })

  it('keeps the sidebar running-first selection distinct from overview visit order', async () => {
    expect((await listVisibleRecentApps()).map(app => app.id)).toEqual(['unvisited', 'newest', 'older'])
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenLastCalledWith('signed-in-user', {
      applicationIds: ['older', 'inaccessible', 'newest'],
      includeRunning: true
    })
    expect((await listRecentlyOpenedApps()).map(app => app.id)).toEqual(['newest', 'older'])
  })

  it('omits dismissed running apps and labels other owners without exposing start', async () => {
    const user = await getCurrentUserContext()
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      ...user,
      isPlatformAdmin: true,
      permissions: { 'applications:start': true, 'applications:create': true }
    })
    vi.mocked(listDismissedRecentAppIds).mockReturnValue(new Set(['unvisited']))
    vi.mocked(getVisibleOwnerDisplayNames).mockResolvedValue(new Map([['another-user', 'Operations']]))
    vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockResolvedValue([
      { ...summary('older'), ownerUserId: 'signed-in-user' },
      { ...summary('newest'), ownerUserId: 'another-user' },
      summary('unvisited', 'running')
    ])
    expect(await listVisibleRecentApps()).toMatchObject([
      { id: 'newest', ownerDisplayName: 'Operations', canStart: false, canClone: true },
      { id: 'older', ownerDisplayName: null, canStart: true, canClone: false }
    ])
  })
})
