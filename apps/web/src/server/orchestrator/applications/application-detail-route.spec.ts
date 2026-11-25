import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/bff/devices/[id]/detail/route'
import { getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { emptyRequest } from '@/server/orchestrator/request'

vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/server/observability/request-id', () => ({ getRequestId: () => Promise.resolve('request-id') }))
vi.mock('@/server/orchestrator/request', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/orchestrator/request')>()),
  emptyRequest: vi.fn()
}))

describe('application detail refresh', () => {
  const id = randomUUID()
  const ownerUserId = randomUUID()
  const revision = 'a'.repeat(64)
  const state = {
    updatedAt: '2026-11-20T12:00:00.000Z',
    status: { message: 'ADB timed out at 192.0.2.2', detail: null, progress: null },
    errors: { lastError: null, application: null }
  }
  const refresh = (known = `${revision}.0`) =>
    GET(new Request(`https://rebroid.example/api/bff/devices/${id}/detail?revision=${known}`), {
      params: Promise.resolve({ id })
    })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: ownerUserId,
      isPlatformAdmin: false,
      effectivePermissions: { 'applications:view-backend-details': false }
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.mocked(emptyRequest).mockResolvedValue({ app: null, state, ownerUserId })
  })

  it('uses the authorized revision and redacts the lifecycle projection', async () => {
    const response = await refresh()
    const [path, init] = vi.mocked(emptyRequest).mock.calls[0]
    expect(path).toBe(`/devices/${id}/detail?revision=${revision}`)
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { app: null, state: { status: { message: 'ADB timed out at [redacted address]' } } }
    })
  })

  it('refreshes configuration after the backend-detail permission changes', async () => {
    expect((await refresh(`${revision}.1`)).status).toBe(200)
    expect(emptyRequest).toHaveBeenCalledWith(`/devices/${id}/detail`, expect.anything())
  })

  it('rejects an expired account or a changed owner', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(
      new PublicActionError('Session expired', { code: 'unauthenticated', status: 401 })
    )
    expect((await refresh()).status).toBe(401)
    expect(getCurrentUser).toHaveBeenCalledWith('api')
    expect(emptyRequest).not.toHaveBeenCalled()
    vi.mocked(emptyRequest).mockResolvedValue({ app: null, state, ownerUserId: 'other-owner' })
    expect((await refresh()).status).toBe(404)
  })

  it('preserves a transient account lookup failure as a server error', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Database unavailable'))
    expect((await refresh()).status).toBe(500)
    expect((await refresh()).status).toBe(200)
  })
})
