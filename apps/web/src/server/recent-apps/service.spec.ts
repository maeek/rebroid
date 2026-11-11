import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoredAppIcon } from '@/server/app-icons/store'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { listRecentlyOpenedApps, listVisibleRecentApps } from './service'
import { listStoredRecentApps } from './store'
import type { AndroidApplicationSummary } from '@/shared/contracts/application'

vi.mock('@/server/app-icons/store', () => ({ getStoredAppIcon: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { listApplicationSummaries: vi.fn() }
}))
vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('./store', () => ({ listStoredRecentApps: vi.fn() }))

const summary = (id: string, currentStatus: 'running' | 'stopped' = 'stopped') =>
  ({ id, name: `App ${id}`, currentStatus, detail: null }) as AndroidApplicationSummary

beforeEach(() => {
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ownerUserId: 'signed-in-user',
    isPlatformAdmin: false,
    permissions: {},
    quotas: {}
  } as Awaited<ReturnType<typeof getCurrentUserContext>>)
  vi.mocked(getStoredAppIcon).mockResolvedValue(null)
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
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenCalledExactlyOnceWith('signed-in-user')
    expect(apps.map(app => app.id)).toEqual(['newest', 'older'])
    expect(vi.mocked(getStoredAppIcon).mock.calls.map(([id]) => id)).toEqual(['newest', 'older'])
  })

  it('allows administrators to revisit other owners while retaining personal history', async () => {
    const user = await getCurrentUserContext()
    vi.mocked(getCurrentUserContext).mockResolvedValue({ ...user, isPlatformAdmin: true })

    expect((await listRecentlyOpenedApps()).map(app => app.id)).toEqual(['newest', 'older'])
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenCalledWith(undefined)
    expect(listStoredRecentApps).toHaveBeenCalledWith('signed-in-user')
  })

  it('keeps the sidebar running-first selection distinct from overview visit order', async () => {
    expect((await listVisibleRecentApps()).map(app => app.id)).toEqual(['unvisited', 'newest', 'older'])
    expect((await listRecentlyOpenedApps()).map(app => app.id)).toEqual(['newest', 'older'])
  })
})
