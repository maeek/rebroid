import { beforeEach, expect, it, vi } from 'vitest'
import { applicationPreview } from '@/shared/testing/application-preview'
import { getCurrentUserContext } from '../current-user'
import { listVisibleApplications } from './application-list-query'
import { orchestratorAppCatalogClient } from './catalog-client'

vi.mock('../current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('./catalog-client', () => ({ orchestratorAppCatalogClient: { listApplications: vi.fn() } }))
const owner = {
  isPlatformAdmin: false,
  ownerUserId: applicationPreview.ownerUserId,
  permissions: {},
  quotas: {}
} as Awaited<ReturnType<typeof getCurrentUserContext>>
const other = { ...applicationPreview, id: 'other', ownerUserId: 'other-owner' }
beforeEach(() => {
  vi.mocked(orchestratorAppCatalogClient.listApplications).mockResolvedValue([applicationPreview, other])
})
it('retains only the signed-in owner and applies backend detail permissions', async () => {
  vi.mocked(getCurrentUserContext).mockResolvedValue(owner)
  const apps = await listVisibleApplications()
  expect(orchestratorAppCatalogClient.listApplications).toHaveBeenCalledWith(owner.ownerUserId)
  expect(apps.map(app => app.id)).toEqual([applicationPreview.id])
  expect(apps[0].runtime.containerName).toBe('Managed container')
})
it('includes all owners for an authorized platform administrator', async () => {
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    ...owner,
    isPlatformAdmin: true,
    permissions: { 'applications:view-backend-details': true } as typeof owner.permissions
  })
  expect(await listVisibleApplications()).toEqual([applicationPreview, other])
  expect(orchestratorAppCatalogClient.listApplications).toHaveBeenCalledWith(undefined)
})
