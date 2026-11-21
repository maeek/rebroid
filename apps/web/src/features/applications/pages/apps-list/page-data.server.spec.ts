import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/bff/apps/gallery/route'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { getAppsListPageData } from './page-data.server'

vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { listApplicationGallery: vi.fn() }
}))
vi.mock('@/server/orchestrator/get-server-ui-settings', () => ({ getServerOrchestratorUiSettings: vi.fn() }))
vi.mock('@/server/app-icons/store', () => ({ getStoredAppIcon: vi.fn() }))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => Promise.resolve('gallery-test') }))
vi.mock('@/server/users/owner-display-names', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/users/owner-display-names')>()),
  getVisibleOwnerDisplayNames: vi.fn()
}))

const owner = {
  isPlatformAdmin: false,
  ownerUserId: 'owner',
  permissions: {},
  quotas: {}
} as Awaited<ReturnType<typeof getCurrentUserContext>>

const row = {
  id: 'app',
  name: 'Inventory',
  ownerUserId: 'owner',
  status: 'running',
  lifecycleStage: 'ready',
  containerImage: 'image',
  apkPackageName: 'com.inventory',
  updatedAt: '2026-11-21T00:00:00.000Z'
} as const

describe('application gallery reads', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserContext).mockResolvedValue(owner)
    vi.mocked(getVisibleOwnerDisplayNames).mockResolvedValue(new Map([['another-owner', 'Operations']]))
    const full = { ...row, containerId: 'private-container', apkFilePath: '/private/test.apk' }
    vi.mocked(orchestratorAppCatalogClient.listApplicationGallery).mockResolvedValue([
      full,
      { ...row, id: 'foreign', ownerUserId: 'another-owner' }
    ])
  })

  it('applies the same owner scope and allowlist on first render and refresh', async () => {
    const page = await getAppsListPageData()
    const response = await GET()
    const publicRow = { ...row, ownerDisplayName: null }
    expect(vi.mocked(orchestratorAppCatalogClient.listApplicationGallery).mock.calls).toEqual([['owner'], ['owner']])
    expect(page.apps).toEqual([{ ...publicRow, running: true, updatedAt: new Date(row.updatedAt), icon: null }])
    expect(await response.json()).toEqual({ ok: true, data: [publicRow], requestId: 'gallery-test' })
    expect(getVisibleOwnerDisplayNames).not.toHaveBeenCalled()
  })

  it('limits administrator owner-name lookup to the gallery rows', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ ...owner, isPlatformAdmin: true })
    const response = await GET()
    expect(orchestratorAppCatalogClient.listApplicationGallery).toHaveBeenCalledWith(undefined)
    expect(getVisibleOwnerDisplayNames).toHaveBeenCalledWith(expect.objectContaining({ isPlatformAdmin: true }), [
      'owner',
      'another-owner'
    ])
    expect(await response.json()).toMatchObject({
      ok: true,
      data: [
        expect.objectContaining({ id: 'app' }),
        expect.objectContaining({ id: 'foreign', ownerDisplayName: 'Operations' })
      ]
    })
  })
})
