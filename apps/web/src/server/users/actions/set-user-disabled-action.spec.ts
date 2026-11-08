import { describe, expect, it, vi } from 'vitest'
import { userService } from '@/server/auth/user'
import { revokeUserViewerSessions } from '../revoke-viewer-sessions'
import { setUserDisabledAction } from './set-user-disabled-action'
vi.mock('../revoke-viewer-sessions', () => ({ revokeUserViewerSessions: vi.fn() }))
vi.mock('../shared', () => ({ requireAdminUser: () => Promise.resolve({ id: 'admin' }), revalidateUsersPage: vi.fn() }))
vi.mock('@/server/actions/safe-action', () => ({ runSafeAction: (operation: () => unknown) => operation() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/auth/user', () => ({ userService: { setUserDisabled: vi.fn() } }))
describe('account disable revocation', () => {
  it('revokes sessions on both sides of the state change', async () => {
    const events: string[] = []
    vi.mocked(revokeUserViewerSessions).mockImplementation(() => {
      events.push('revoke')
      return Promise.resolve()
    })
    vi.mocked(userService.setUserDisabled).mockImplementation(() => {
      events.push('disable')
      return Promise.resolve({ id: 'user' } as never)
    })
    await setUserDisabledAction('user', true)
    expect(events).toEqual(['revoke', 'disable', 'revoke'])
  })
  it('fails closed when viewer revocation fails', async () => {
    vi.mocked(revokeUserViewerSessions).mockRejectedValue(new Error('unavailable'))
    await expect(setUserDisabledAction('user', true)).rejects.toThrow('unavailable')
    expect(userService.setUserDisabled).not.toHaveBeenCalled()
  })
})
