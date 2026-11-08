import { beforeEach, describe, expect, it, vi } from 'vitest'
import { orchestratorAppCatalogClient } from '../applications/catalog-client'
import { requireAdminUser } from '../shared'
import { resolveContainerApplicationNames } from './container-application-names'
import { platformContainersGridPage } from './platform-grid-utils'
import type { PlatformContainer } from '@/shared/contracts/platform'

vi.mock('../shared', () => ({ requireAdminUser: vi.fn() }))
vi.mock('../applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { listApplicationSummaries: vi.fn() }
}))
const container: PlatformContainer = {
  id: 'container',
  shortId: 'short',
  names: ['Worker'],
  applicationId: 'app-id',
  image: 'runtime',
  imageId: 'image',
  state: 'running',
  status: 'Up',
  managed: true,
  orphaned: false,
  component: 'runtime',
  networks: [],
  ports: [],
  labels: {},
  command: 'boot',
  createdAt: '2026-01-01'
}

beforeEach(() => {
  vi.mocked(requireAdminUser).mockResolvedValue(undefined as never)
  vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockReset()
})

describe('container application names', () => {
  it('checks authorization before reading names', async () => {
    vi.mocked(requireAdminUser).mockRejectedValue(new Error('Forbidden'))
    await expect(resolveContainerApplicationNames([container])).rejects.toThrow('Forbidden')
    expect(orchestratorAppCatalogClient.listApplicationSummaries).not.toHaveBeenCalled()
  })

  it('resolves a whole dataset in one lookup and retains missing references', async () => {
    vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockResolvedValue([
      { id: 'app-id', name: 'Inventory worker' }
    ] as Awaited<ReturnType<typeof orchestratorAppCatalogClient.listApplicationSummaries>>)
    const result = await resolveContainerApplicationNames([
      container,
      { ...container, id: 'other', applicationId: 'deleted' }
    ])
    expect(result[0]).toMatchObject({ applicationId: 'app-id', applicationName: 'Inventory worker' })
    expect(result[1]).toMatchObject({ applicationId: 'deleted', applicationName: null })
    expect(orchestratorAppCatalogClient.listApplicationSummaries).toHaveBeenCalledOnce()
    expect(platformContainersGridPage(result, { q: 'Inventory worker' }).items).toHaveLength(1)
    expect(platformContainersGridPage(result).facets.applicationNames).toEqual({ 'app-id': 'Inventory worker' })
  })

  it('preserves inventory when names are unavailable and skips lookup for unmanaged containers', async () => {
    vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockRejectedValue(new Error('Unavailable'))
    expect((await resolveContainerApplicationNames([container]))[0]).toMatchObject({ applicationName: null })
    vi.mocked(orchestratorAppCatalogClient.listApplicationSummaries).mockClear()
    await resolveContainerApplicationNames([{ ...container, applicationId: null }])
    expect(orchestratorAppCatalogClient.listApplicationSummaries).not.toHaveBeenCalled()
  })
})
