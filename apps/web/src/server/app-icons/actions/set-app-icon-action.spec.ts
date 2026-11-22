import { expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/bff/applications/[id]/icon/route'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { removeStoredAppIcon, setInitialStoredAppIcon } from '../store'
import { setAppIconAction } from './set-app-icon-action'

vi.mock('@/server/orchestrator/current-user', () => ({ getCurrentUserContext: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { getViewerRuntime: vi.fn() }
}))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => 'request-id' }))
vi.mock('../store', () => ({ removeStoredAppIcon: vi.fn(), setInitialStoredAppIcon: vi.fn() }))
vi.mock('../shared', () => ({ revalidateAppIconPaths: vi.fn() }))

it('requires ownership for both icon mutations, including administrators and stopped apps', async () => {
  const id = '98a530d6-a45d-466a-9cb4-c023067c4971'
  vi.mocked(getCurrentUserContext).mockResolvedValue({ ownerUserId: 'owner', isPlatformAdmin: true } as Awaited<
    ReturnType<typeof getCurrentUserContext>
  >)
  vi.mocked(orchestratorAppCatalogClient.getViewerRuntime).mockResolvedValue({
    ownerUserId: 'other',
    containerId: null,
    status: 'stopped'
  })
  expect((await setAppIconAction(id, null)).ok).toBe(false)
  const response = await PATCH(new Request('https://example.test', { method: 'PATCH' }), {
    params: Promise.resolve({ id })
  })
  expect(response.status).toBe(403)
  expect(getCurrentUserContext).toHaveBeenCalledWith('api')
  expect(removeStoredAppIcon).not.toHaveBeenCalled()
  expect(setInitialStoredAppIcon).not.toHaveBeenCalled()
  vi.mocked(orchestratorAppCatalogClient.getViewerRuntime).mockResolvedValue({
    ownerUserId: 'owner',
    containerId: null,
    status: 'stopped'
  })
  expect((await setAppIconAction(id, null)).ok).toBe(true)
  expect(removeStoredAppIcon).toHaveBeenCalledWith(id)
})
