import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentSessionIdentity } from '@/server/auth/authorization'
import { userService } from '@/server/auth/user'
import { findActiveAccountSession } from '@/server/persistence/account-sessions-repository'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { revokeUserViewerSessions } from '@/server/users/revoke-viewer-sessions'
import { defaultUserQuota } from '@/shared/permissions/permissions'
import { requireFeature } from '../features'
import { assertCanUseOwnedApplicationRuntime } from './actions/common/action-helpers'
import { issueViewerGrant } from './viewer-grant-access'
import type { PublicUser } from '@/shared/contracts/auth-user'

vi.mock('@/server/auth/authorization', () => ({ getCurrentSessionIdentity: vi.fn() }))
vi.mock('@/server/auth/user', () => ({ userService: { getUserById: vi.fn() } }))
vi.mock('@/server/persistence/account-sessions-repository', () => ({ findActiveAccountSession: vi.fn() }))
vi.mock('@/server/persistence/web-maintenance-repository', () => ({ hasPendingViewerRevocation: vi.fn() }))
vi.mock('@/server/users/revoke-viewer-sessions', () => ({ revokeUserViewerSessions: vi.fn() }))
vi.mock('../features', () => ({ requireFeature: vi.fn() }))
vi.mock('./actions/common/action-helpers', () => ({
  assertCanUseOwnedApplicationRuntime: vi.fn(),
  ownedRuntimeMessage: 'Viewer access requires ownership.',
  ownedRuntimeControlMessage: 'Viewer control requires ownership.'
}))

const permissions = { 'applications:control-viewer': true, 'applications:sync-clipboard': true } as const
const account = {
  id: 'user',
  sessionVersion: 3,
  isPlatformAdmin: false,
  disabled: false,
  passwordChangeRequired: false,
  effectivePermissions: permissions,
  effectiveQuotas: defaultUserQuota
} as PublicUser

describe('viewer grant issuance', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getCurrentSessionIdentity).mockResolvedValue({
      userId: account.id,
      sessionId: 'current-session',
      sessionVersion: account.sessionVersion,
      authEpoch: 'current-epoch'
    })
    vi.mocked(findActiveAccountSession).mockReturnValue({ lastActiveAt: 0, passwordChangeRequired: 0 })
    vi.mocked(userService.getUserById).mockResolvedValue(account)
    vi.mocked(assertCanUseOwnedApplicationRuntime).mockResolvedValue({
      app: { id: 'app' } as never,
      user: { ownerUserId: 'user', isPlatformAdmin: false, permissions, quotas: defaultUserQuota }
    })
    vi.mocked(hasPendingViewerRevocation).mockReturnValue(false)
  })

  it.each(['main', 'virtual'] as const)(
    'derives the same capabilities and checks the current %s grant',
    async surface => {
      const mint = vi.fn().mockResolvedValue({ id: 'viewer' })
      await expect(issueViewerGrant('app', surface, mint)).resolves.toMatchObject({ grant: { id: 'viewer' } })
      expect(mint).toHaveBeenCalledExactlyOnceWith({ control: true, clipboard: true, screenshot: false })
      expect(requireFeature).toHaveBeenCalledTimes(surface === 'virtual' ? 1 : 0)
      expect(userService.getUserById).toHaveBeenCalledWith('user')
    }
  )

  it.each([
    null,
    { ...account, disabled: true },
    { ...account, passwordChangeRequired: true },
    { ...account, effectivePermissions: {} }
  ])('revokes the owner’s sessions and rejects a grant when its account access changes', async current => {
    vi.mocked(userService.getUserById).mockResolvedValue(current)
    await expect(issueViewerGrant('app', 'main', () => Promise.resolve({}))).rejects.toThrow('authorization changed')
    expect(revokeUserViewerSessions).toHaveBeenCalledExactlyOnceWith('user')
  })

  it.each(['main', 'virtual'] as const)(
    'withholds a %s grant when the initiating session changes during mint',
    async surface => {
      const entered = Promise.withResolvers<void>()
      const response = Promise.withResolvers<{ id: string }>()
      const pending = issueViewerGrant('app', surface, () => {
        entered.resolve()
        return response.promise
      })
      await entered.promise
      vi.mocked(userService.getUserById).mockResolvedValue({ ...account, sessionVersion: account.sessionVersion + 1 })
      response.resolve({ id: 'possibly-reused-viewer' })

      await expect(pending).rejects.toThrow('authorization changed')
      expect(revokeUserViewerSessions).not.toHaveBeenCalled()
    }
  )

  it('withholds a grant when the initiating session is revoked during mint', async () => {
    await expect(
      issueViewerGrant('app', 'main', () => {
        vi.mocked(findActiveAccountSession).mockReturnValue(undefined)
        return Promise.resolve({})
      })
    ).rejects.toThrow('authorization changed')
    expect(revokeUserViewerSessions).not.toHaveBeenCalled()
  })

  it('checks pending revocation before and after mint', async () => {
    const mint = vi.fn().mockResolvedValue({})
    vi.mocked(hasPendingViewerRevocation).mockReturnValue(true)
    await expect(issueViewerGrant('app', 'main', mint)).rejects.toThrow('Viewer access is being updated')
    expect(mint).not.toHaveBeenCalled()

    vi.mocked(hasPendingViewerRevocation).mockReturnValueOnce(false)
    await expect(issueViewerGrant('app', 'main', mint)).rejects.toThrow('Viewer access is being updated')
    expect(mint).toHaveBeenCalledTimes(1)
  })
})
