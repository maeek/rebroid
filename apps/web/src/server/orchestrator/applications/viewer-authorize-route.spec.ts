import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/internal/viewer/authorize/route'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { defaultUserPermissions } from '@/shared/permissions/permissions'

vi.mock('@/server/auth/account-sessions', () => ({ isCurrentAccountSession: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn(), getCurrentSessionIdentity: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { getViewerRuntime: vi.fn() }
}))
vi.mock('@/server/persistence/web-maintenance-repository', () => ({ hasPendingViewerRevocation: vi.fn() }))

const appId = 'ea66b0de-1278-4cf4-8e04-f25a56181ac3'
const containerId = 'a'.repeat(64)

const requestFor = (secret = 'internal-fixture') =>
  new Request('http://web/api/internal/viewer/authorize', {
    headers: {
      'x-orchestrator-secret': secret,
      'x-rebroid-viewer-app': appId,
      'x-rebroid-viewer-owner': 'alice',
      'x-rebroid-viewer-runtime': containerId
    }
  })

const account = (id: string) =>
  ({
    id,
    effectivePermissions: { ...defaultUserPermissions, 'applications:sync-clipboard': false }
  }) as Awaited<ReturnType<typeof getCurrentUser>>

const app = (ownerUserId: string, runtimeId: string) =>
  ({
    ownerUserId,
    status: 'running',
    containerId: runtimeId
  }) as Awaited<ReturnType<typeof orchestratorAppCatalogClient.getViewerRuntime>>

describe('internal viewer authorization', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
  })

  it('requires a service secret and a current matching web account', async () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'internal-fixture')
    expect((await GET(requestFor('wrong'))).status).toBe(401)
    expect(getCurrentUser).not.toHaveBeenCalled()
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('login required'))
    expect((await GET(requestFor())).status).toBe(403)
    vi.mocked(getCurrentUser).mockResolvedValue(account('bob'))
    expect((await GET(requestFor())).status).toBe(403)
    expect(orchestratorAppCatalogClient.getViewerRuntime).not.toHaveBeenCalled()
  })

  it('requires the same running app and container and denies pending revocations', async () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'internal-fixture')
    vi.mocked(getCurrentUser).mockResolvedValue(account('alice'))
    vi.mocked(getCurrentSessionIdentity).mockResolvedValue({
      userId: 'alice',
      sessionId: 'browser',
      sessionVersion: 1,
      authEpoch: 'epoch'
    })
    vi.mocked(isCurrentAccountSession).mockReturnValue(true)
    vi.mocked(orchestratorAppCatalogClient.getViewerRuntime)
      .mockResolvedValueOnce(app('bob', containerId))
      .mockResolvedValueOnce(app('alice', 'b'.repeat(64)))
      .mockResolvedValue(app('alice', containerId))
    expect((await GET(requestFor())).status).toBe(403)
    expect((await GET(requestFor())).status).toBe(403)
    const response = await GET(requestFor())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ownerUserId: 'alice', capabilities: { clipboard: false } })
    vi.mocked(hasPendingViewerRevocation).mockReturnValueOnce(false).mockReturnValueOnce(true)
    expect((await GET(requestFor())).status).toBe(403)
    vi.mocked(isCurrentAccountSession).mockReturnValue(false)
    expect((await GET(requestFor())).status).toBe(403)
  })
})
