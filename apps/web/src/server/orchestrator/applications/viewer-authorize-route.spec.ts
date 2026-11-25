import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/internal/viewer/authorize/route'
import { isCurrentAccountSession } from '@/server/auth/account-sessions'
import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { defaultUserPermissions } from '@/shared/permissions/permissions'

vi.mock('@/server/auth/account-sessions', () => ({ isCurrentAccountSession: vi.fn() }))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn(), getCurrentSessionIdentity: vi.fn() }))
vi.mock('@/server/orchestrator/applications/catalog-client', () => ({
  orchestratorAppCatalogClient: { getViewerRuntime: vi.fn() }
}))
vi.mock('@/server/persistence/web-maintenance-repository', () => ({ hasPendingViewerRevocation: vi.fn() }))
vi.mock('@/server/orchestrator/external-devices/client', () => ({ externalDeviceClient: { attachment: vi.fn() } }))

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

const app = (
  ownerUserId: string,
  runtimeId: string | null,
  deviceId = appId
): Awaited<ReturnType<typeof orchestratorAppCatalogClient.getViewerRuntime>> => ({
  deviceId,
  kind: 'managed',
  ownerUserId,
  runtimeId
})

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

  it('requires a matching device and runtime and denies pending revocations', async () => {
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
      .mockResolvedValueOnce(app('alice', null))
      .mockResolvedValueOnce(app('alice', containerId, 'different-device'))
      .mockResolvedValue(app('alice', containerId))
    expect((await GET(requestFor())).status).toBe(403)
    expect((await GET(requestFor())).status).toBe(403)
    expect((await GET(requestFor())).status).toBe(403)
    expect((await GET(requestFor())).status).toBe(403)
    const response = await GET(requestFor())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ownerUserId: 'alice',
      accountSessionId: 'browser',
      capabilities: { clipboard: false }
    })
    vi.mocked(hasPendingViewerRevocation).mockReturnValueOnce(false).mockReturnValueOnce(true)
    expect((await GET(requestFor())).status).toBe(403)
    vi.mocked(isCurrentAccountSession).mockReturnValue(false)
    expect((await GET(requestFor())).status).toBe(403)
  })

  it('requires the broker credential, owner, and the exact external attachment', async () => {
    vi.stubEnv('ORCHESTRATOR_SHARED_SECRET', 'internal-fixture')
    vi.stubEnv('EXTERNAL_ADB_BROKER_SECRET', 'external-fixture')
    const attachment = 'b366959d-f03c-4312-bce2-0042daa286d5'
    const externalRequest = (secret: string) => {
      const request = requestFor(secret)
      request.headers.set('x-rebroid-viewer-kind', 'external')
      request.headers.set('x-rebroid-viewer-runtime', attachment)
      return request
    }
    expect((await GET(externalRequest('internal-fixture'))).status).toBe(401)
    vi.mocked(getCurrentUser).mockResolvedValue(account('alice'))
    expect((await GET(externalRequest('external-fixture'))).status).toBe(403)
    expect(externalDeviceClient.attachment).not.toHaveBeenCalled()
    const allowed = account('alice')
    allowed.effectivePermissions['devices:use-external'] = true
    vi.mocked(getCurrentUser).mockResolvedValue(allowed)
    vi.mocked(getCurrentSessionIdentity).mockResolvedValue({
      userId: 'alice',
      sessionId: 'browser',
      sessionVersion: 1,
      authEpoch: 'epoch'
    })
    vi.mocked(isCurrentAccountSession).mockReturnValue(true)
    vi.mocked(externalDeviceClient.attachment)
      .mockResolvedValueOnce({ deviceId: appId, ownerUserId: 'alice', attachmentId: 'replacement' })
      .mockResolvedValueOnce({ deviceId: appId, ownerUserId: 'alice', attachmentId: attachment })
    expect((await GET(externalRequest('external-fixture'))).status).toBe(403)
    expect((await GET(externalRequest('external-fixture'))).status).toBe(200)
    expect(orchestratorAppCatalogClient.getViewerRuntime).not.toHaveBeenCalled()
  })
})
