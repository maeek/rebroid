import { expect, it, vi } from 'vitest'
import { isCurrentAccountSession } from './account-sessions'
import { getServerAuthSession } from './auth'
import { requireAdmin } from './authorization'
import { userService } from './user'

vi.mock('./auth', () => ({ getServerAuthSession: vi.fn() }))
vi.mock('./account-sessions', () => ({ isCurrentAccountSession: vi.fn() }))
vi.mock('./user', () => ({ userService: { getUserById: vi.fn() } }))

it('distinguishes expired sessions, non-admin accounts and admin access for APIs', async () => {
  vi.mocked(getServerAuthSession).mockResolvedValue(null)
  await expect(requireAdmin('api')).rejects.toMatchObject({ code: 'unauthenticated', status: 401 })

  const identity = { id: 'user', sessionId: 'session', sessionVersion: 1, authEpoch: 'epoch' }
  vi.mocked(getServerAuthSession).mockResolvedValue({ user: identity } as Awaited<
    ReturnType<typeof getServerAuthSession>
  >)
  vi.mocked(isCurrentAccountSession).mockReturnValue(true)
  const account = { id: 'user', isPlatformAdmin: false } as NonNullable<
    Awaited<ReturnType<typeof userService.getUserById>>
  >
  vi.mocked(userService.getUserById).mockResolvedValue(account)
  await expect(requireAdmin('api')).rejects.toMatchObject({ code: 'forbidden', status: 403 })
  await expect(requireAdmin()).rejects.toHaveProperty('digest', expect.stringContaining('/apps'))
  vi.mocked(userService.getUserById).mockResolvedValue({ ...account, isPlatformAdmin: true })
  await expect(requireAdmin('api')).resolves.toMatchObject({ id: 'user', isPlatformAdmin: true })
})
