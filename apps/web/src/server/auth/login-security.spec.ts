import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPersistentRateLimits, consumePersistentRateLimit } from '@/server/persistence/auth-security-repository'
import { clearLoginAccountAttempts, consumeLoginAttempt } from './login-security'

vi.mock('@/server/persistence/auth-security-repository', () => ({
  clearPersistentRateLimits: vi.fn(),
  consumePersistentRateLimit: vi.fn()
}))

describe('login throttling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('leaves the account budget untouched when the source is exhausted', () => {
    vi.mocked(consumePersistentRateLimit).mockReturnValue(false)
    expect(consumeLoginAttempt('account', 'source').allowed).toBe(false)
    expect(consumePersistentRateLimit).toHaveBeenCalledExactlyOnceWith(expect.any(String), 50, 900_000)
  })

  it('clears only the account budget after successful authentication', () => {
    vi.mocked(consumePersistentRateLimit).mockReturnValue(true)
    const { allowed, accountKey } = consumeLoginAttempt('account', 'source')
    expect(allowed).toBe(true)
    expect(consumePersistentRateLimit).toHaveBeenNthCalledWith(2, accountKey, 10, 900_000)
    clearLoginAccountAttempts(accountKey)
    expect(clearPersistentRateLimits).toHaveBeenCalledExactlyOnceWith([accountKey])
  })
})
