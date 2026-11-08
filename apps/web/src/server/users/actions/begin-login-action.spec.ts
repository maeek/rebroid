import { describe, expect, it, vi } from 'vitest'
import { consumeLoginAttempt, clearLoginAttempts } from '@/server/auth/login-security'
import { beginLoginAction } from './begin-login-action'
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }))
vi.mock('@/server/actions/safe-action', () => ({ runSafeAction: (operation: () => unknown) => operation() }))
vi.mock('@/server/audit/events', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/server/auth/user', () => ({
  userService: { verifyPrimaryCredentials: () => Promise.resolve({ mfaRequired: true }) }
}))
vi.mock('@/server/auth/login-security', () => ({
  consumeLoginAttempt: vi.fn(),
  clearLoginAttempts: vi.fn(),
  loginSourceFromHeaders: () => 'source'
}))
describe('primary authentication', () => {
  it('preserves second-factor failure counters after password verification', async () => {
    vi.mocked(consumeLoginAttempt).mockReturnValue({ allowed: true, keys: ['account', 'source'] })
    await expect(beginLoginAction({ username: 'user', password: 'password' })).resolves.toMatchObject({
      mfaRequired: true
    })
    expect(clearLoginAttempts).not.toHaveBeenCalled()
  })
})
