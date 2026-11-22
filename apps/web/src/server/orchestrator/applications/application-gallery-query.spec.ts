import { expect, it, vi } from 'vitest'
import { getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { listApplicationNames } from './application-gallery-query'
import { orchestratorAppCatalogClient } from './catalog-client'

vi.mock('./catalog-client', () => ({ orchestratorAppCatalogClient: { listApplicationGallery: vi.fn() } }))
vi.mock('@/server/users/owner-display-names', () => ({ getVisibleOwnerDisplayNames: vi.fn() }))

it.each([false, true])('returns only visible names in catalog order for admin=%s', async isPlatformAdmin => {
  const rows = [
    { id: 'second', name: 'B', ownerUserId: 'other', containerImage: 'other-image' },
    { id: 'first', name: 'A', ownerUserId: 'owner', containerImage: 'image' }
  ] as Awaited<ReturnType<typeof orchestratorAppCatalogClient.listApplicationGallery>>
  vi.mocked(orchestratorAppCatalogClient.listApplicationGallery).mockResolvedValue(rows)
  const user = { ownerUserId: 'owner', isPlatformAdmin } as Parameters<typeof listApplicationNames>[0]
  const names = await listApplicationNames(user)
  expect(names).toEqual(
    isPlatformAdmin
      ? [
          { id: 'second', name: 'B' },
          { id: 'first', name: 'A' }
        ]
      : [{ id: 'first', name: 'A' }]
  )
  expect(orchestratorAppCatalogClient.listApplicationGallery).toHaveBeenCalledWith(
    isPlatformAdmin ? undefined : 'owner'
  )
  expect(getVisibleOwnerDisplayNames).not.toHaveBeenCalled()
})
