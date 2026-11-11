import { describe, expect, it, vi } from 'vitest'
import { userService } from '@/server/auth/user'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { revokeUserViewerSessions } from '@/server/users/revoke-viewer-sessions'
import { assertViewerGrantCurrent } from './viewer-grant-access'
vi.mock('@/server/persistence/web-maintenance-repository', () => ({ hasPendingViewerRevocation: vi.fn() }))
vi.mock('@/server/auth/user', () => ({ userService: { getUserById: vi.fn() } }))
vi.mock('@/server/users/revoke-viewer-sessions', () => ({ revokeUserViewerSessions: vi.fn() }))
const grant = {
  ownerUserId: 'user',
  isPlatformAdmin: false,
  permissions: { 'applications:control-viewer': true }
} as Parameters<typeof assertViewerGrantCurrent>[0]
describe('viewer grant revocation races', () => {
  it.each([
    null,
    { isPlatformAdmin: false, disabled: true },
    { isPlatformAdmin: false, passwordChangeRequired: true },
    { isPlatformAdmin: false, effectivePermissions: {} }
  ])('revokes sessions and rejects stale grants', async account => {
    vi.mocked(userService.getUserById).mockResolvedValue(account as never)
    await expect(assertViewerGrantCurrent(grant)).rejects.toThrow('authorization changed')
    expect(revokeUserViewerSessions).toHaveBeenCalledWith('user')
  })
  it('retains grants whose current permissions still allow them', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({
      isPlatformAdmin: false,
      effectivePermissions: grant.permissions
    } as never)
    await expect(assertViewerGrantCurrent(grant)).resolves.toBeUndefined()
    expect(revokeUserViewerSessions).not.toHaveBeenCalled()
  })
  it('withholds new grants while a committed revocation is pending', async () => {
    vi.mocked(userService.getUserById).mockResolvedValue({
      isPlatformAdmin: false,
      effectivePermissions: grant.permissions
    } as never)
    vi.mocked(hasPendingViewerRevocation).mockReturnValue(true)
    await expect(assertViewerGrantCurrent(grant)).rejects.toThrow('Viewer access is being updated')
  })
})
