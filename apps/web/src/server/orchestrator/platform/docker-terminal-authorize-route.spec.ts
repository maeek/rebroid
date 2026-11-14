import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/internal/docker-terminal/authorize/route'
import { getCurrentSessionIdentity, getCurrentUser } from '@/server/auth/authorization'
import { hasInternalSecret } from '@/server/auth/internal-secret'

vi.mock('@/server/auth/authorization', () => ({ getCurrentUser: vi.fn(), getCurrentSessionIdentity: vi.fn() }))
vi.mock('@/server/auth/internal-secret', () => ({ hasInternalSecret: vi.fn() }))

const request = new Request('http://web/api/internal/docker-terminal/authorize')
const identity = { userId: 'account', sessionId: 'session', sessionVersion: 0, authEpoch: 'epoch' }

describe('container terminal authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(hasInternalSecret).mockReturnValue(true)
    vi.mocked(getCurrentSessionIdentity).mockResolvedValue(identity)
  })

  it('requires the private service credential', async () => {
    vi.mocked(hasInternalSecret).mockReturnValue(false)
    expect((await GET(request)).status).toBe(401)
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('grants Administrators access without a stored permission and rejects custom group grants', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: identity.userId,
      isPlatformAdmin: true,
      effectivePermissions: {}
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    const allowed = await GET(request)
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toEqual({ userId: identity.userId, accountSessionId: identity.sessionId })

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: identity.userId,
      isPlatformAdmin: false,
      effectivePermissions: { 'docker:open-terminal': true }
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>)
    expect((await GET(request)).status).toBe(403)
  })

  it('rejects a revoked account session', async () => {
    vi.mocked(getCurrentSessionIdentity).mockRejectedValue(new Error('Revoked'))
    expect((await GET(request)).status).toBe(403)
  })
})
