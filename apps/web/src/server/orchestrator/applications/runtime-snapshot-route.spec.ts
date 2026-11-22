import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/bff/applications/[id]/runtime/snapshot/route'
import { getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { OrchestratorRequestError, request } from '@/server/orchestrator/request'

vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => Promise.resolve('request-id') }))
vi.mock('@/server/orchestrator/request', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/orchestrator/request')>()),
  request: vi.fn()
}))

describe('application snapshot endpoint', () => {
  const id = randomUUID()
  const accountId = randomUUID()
  const snapshot = {
    mimeType: 'image/webp',
    dataUrl: 'data:image/webp;base64,UklGRg==',
    capturedAt: '2026-11-13T10:00:00.000Z'
  }
  const getSnapshot = (appId: string = id) =>
    GET(
      new Request(`https://rebroid.example/api/bff/applications/${appId}/runtime/snapshot`, {
        headers: { 'x-rebroid-snapshot-owner': 'spoofed-owner' }
      }),
      { params: Promise.resolve({ id: appId }) }
    )

  const account = (allowed: boolean) =>
    ({
      id: accountId,
      isPlatformAdmin: true,
      effectivePermissions: { 'applications:capture-screenshot': allowed }
    }) as Awaited<ReturnType<typeof getCurrentUser>>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(account(true))
  })

  it('forwards only the current account ID and returns a private result', async () => {
    vi.mocked(request).mockResolvedValue(snapshot)
    const response = await getSnapshot()
    expect(request).toHaveBeenCalledWith(
      `/apps/${id}/runtime/snapshot`,
      expect.objectContaining({ headers: { 'x-rebroid-snapshot-owner': accountId } }),
      expect.anything()
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-request-id')).toBe('request-id')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: snapshot })
  })

  it('does not bypass the orchestrator ownership check for an administrator', async () => {
    vi.mocked(request).mockRejectedValue(new OrchestratorRequestError('Snapshot unavailable', 404))
    const response = await getSnapshot()
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } })
  })

  it('requires authentication, permission and a valid application ID before requesting a snapshot', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(
      new PublicActionError('Session expired', { code: 'unauthenticated', status: 401 })
    )
    expect((await getSnapshot()).status).toBe(401)
    expect(getCurrentUser).toHaveBeenCalledWith('api')
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Account store unavailable'))
    expect((await getSnapshot()).status).toBe(500)
    vi.mocked(getCurrentUser).mockResolvedValue(account(false))
    expect((await getSnapshot()).status).toBe(403)
    expect((await getSnapshot('invalid')).status).toBe(400)
    expect(request).not.toHaveBeenCalled()
  })
})
