import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listActiveAccountSessions } from '@/server/persistence/account-sessions-repository'
import { resetDatabaseForTests } from '@/server/persistence/database'
import {
  accountSessionMaxAgeSeconds,
  checkAccountSession,
  revokeAccountSessions,
  startAccountSession
} from './account-sessions'
import { authOptions } from './auth'
import { completeTestAdministratorSetup, createTestSessionIdentity } from './test-administrator'
import { userService } from './user'
import type { AdministratorMutation } from './user-store'

vi.mock('@/server/users/revoke-viewer-sessions', () => ({
  revokeViewerSessionsForUsers: vi.fn().mockResolvedValue(undefined)
}))

describe('account sessions', () => {
  let directory: string
  let admin: AdministratorMutation

  const createMember = async (username: string) => {
    const user = await userService.createUser({ username, password: 'temporary-password' }, admin)
    return userService.completeRequiredPasswordChange(user.id, 'temporary-password', 'replacement-password')
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-account-sessions-'))
    vi.stubEnv('WEB_DATABASE_PATH', join(directory, 'web.sqlite'))
    vi.stubEnv('INITIAL_ADMIN_PASSWORD', 'initial-admin-password')
    admin = await completeTestAdministratorSetup()
  })

  afterEach(async () => {
    vi.useRealTimers()
    resetDatabaseForTests()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it('rejects a revoked cookie after a restart and keeps the acting browser signed in', async () => {
    const user = await createMember('member')
    const current = createTestSessionIdentity(user)
    const other = startAccountSession(user, 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0')!
    const cookieSession = async (token: typeof other) =>
      authOptions.callbacks!.session!({
        token,
        session: { expires: '', user: { id: user.id } },
        user: { id: user.id, email: 'member@example.invalid', emailVerified: null },
        newSession: undefined,
        trigger: 'update'
      })

    expect(listActiveAccountSessions(user.id, current.sessionId)).toMatchObject([
      { id: current.sessionId, current: true },
      { id: other.sessionId, current: false, browser: 'Firefox', operatingSystem: 'Linux' }
    ])
    await expect(cookieSession(other)).resolves.toMatchObject({ user: { sessionId: other.sessionId } })
    expect(revokeAccountSessions(current, user.id, current.sessionId)).toBe(0)
    expect(revokeAccountSessions(current, user.id, other.sessionId)).toBe(1)
    resetDatabaseForTests()
    await expect(cookieSession(other)).resolves.not.toHaveProperty('user')
    await expect(cookieSession(current)).resolves.toMatchObject({ user: { sessionId: current.sessionId } })
    expect(() => revokeAccountSessions(other, user.id, null)).toThrow('Your access changed')
  })

  it('limits bulk and individual revocation to the intended account', async () => {
    const member = await createMember('member')
    const another = await createMember('another')
    const current = createTestSessionIdentity(member)
    const other = createTestSessionIdentity(member)
    const foreign = createTestSessionIdentity(another)

    expect(revokeAccountSessions(current, member.id, foreign.sessionId)).toBe(0)
    expect(() => revokeAccountSessions(current, another.id, null)).toThrow('Your access changed')
    expect(revokeAccountSessions(current, member.id, null)).toBe(1)
    expect(checkAccountSession(other)).toBeNull()
    expect(checkAccountSession(current)).not.toBeNull()
    expect(revokeAccountSessions(admin.identity, another.id, null)).toBe(1)
    expect(checkAccountSession(foreign)).toBeNull()
    expect(checkAccountSession(admin.identity)).not.toBeNull()
  })

  it('retains cookie renewal and signs out only the initiating browser', async () => {
    const user = await createMember('member')
    vi.useFakeTimers({ toFake: ['Date'] })
    const now = Date.now()
    const lifetimeMs = accountSessionMaxAgeSeconds * 1000
    const original = createTestSessionIdentity(user)
    const refreshed = createTestSessionIdentity(user)
    vi.setSystemTime(now + lifetimeMs - 60_000)
    await authOptions.jwt!.encode!({ secret: 'session-test-secret', token: refreshed })
    vi.setSystemTime(now + lifetimeMs + 60_000)
    expect(checkAccountSession(original)).toBeNull()
    expect(checkAccountSession(refreshed)).not.toBeNull()

    const current = createTestSessionIdentity(user)
    await authOptions.events!.signOut!({ token: refreshed, session: { expires: '', user: { id: user.id } } })
    expect(checkAccountSession(refreshed)).toBeNull()
    expect(checkAccountSession(current)).not.toBeNull()
  })
})
