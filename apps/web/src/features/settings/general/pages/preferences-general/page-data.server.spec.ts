import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPreferencesSecurityPageData } from '@/features/settings/security/pages/preferences-security/page-data.server'
import { getCurrentSessionIdentity, getCurrentUser, requireAdmin } from '@/server/auth/authorization'
import { listActiveAccountSessions } from '@/server/persistence/account-sessions-repository'
import { getWebSettings } from '@/server/web-settings/store'
import { getPreferencesGeneralPageData } from './page-data.server'

vi.mock('@/server/auth/authorization', () => ({
  getCurrentSessionIdentity: vi.fn(),
  getCurrentUser: vi.fn(),
  requireAdmin: vi.fn()
}))
vi.mock('@/server/persistence/account-sessions-repository', () => ({ listActiveAccountSessions: vi.fn() }))
vi.mock('@/server/web-settings/store', () => ({ getWebSettings: vi.fn() }))

describe('preferences and console settings scope', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each([false, true])('loads only personal data for preferences (administrator: %s)', async isPlatformAdmin => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      name: 'Operator',
      avatarDataUrl: null,
      accentColor: 'blue',
      mfaEnabled: true,
      isPlatformAdmin
    } as Awaited<ReturnType<typeof getCurrentUser>>)
    vi.mocked(getCurrentSessionIdentity).mockResolvedValue({
      userId: 'operator',
      sessionId: 'browser-session',
      sessionVersion: 1,
      authEpoch: 'epoch'
    })
    vi.mocked(listActiveAccountSessions).mockReturnValue([])
    expect(await getPreferencesGeneralPageData()).toEqual({
      user: { name: 'Operator', avatarDataUrl: null, accentColor: 'blue' }
    })
    expect(await getPreferencesSecurityPageData()).toEqual({ mfaEnabled: true, sessions: [] })
    expect(listActiveAccountSessions).toHaveBeenCalledWith('operator', 'browser-session')
    expect(getWebSettings).not.toHaveBeenCalled()
    expect(requireAdmin).not.toHaveBeenCalled()
  })
})
