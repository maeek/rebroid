import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabaseForTests } from '@/server/persistence/database'
import { saveMfaSetup } from '@/server/persistence/mfa-setup-repository'
import { revokeViewerSessionsForUsers } from '@/server/users/revoke-viewer-sessions'
import { encryptMfaSecret } from './mfa-crypto'
import { completeTestAdministratorSetup } from './test-administrator'
import { userService } from './user'

vi.mock('@/server/users/revoke-viewer-sessions', () => ({ revokeViewerSessionsForUsers: vi.fn() }))

describe('user MFA service', () => {
  let tempDirectory: string

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'rebroid-mfa-'))
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'web.sqlite')
    process.env.INITIAL_ADMIN_PASSWORD = 'initial-admin-password'
    process.env.MFA_ENCRYPTION_KEY = 'test-encryption-key-that-is-at-least-32-characters'
  })

  afterEach(async () => {
    vi.useRealTimers()
    delete process.env.WEB_DATABASE_PATH
    delete process.env.INITIAL_ADMIN_PASSWORD
    delete process.env.MFA_ENCRYPTION_KEY
    resetDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('enables MFA, requires a factor, and consumes recovery codes once', async () => {
    const administrator = await completeTestAdministratorSetup()
    const user = await userService.createUser({ username: 'user', password: 'original-password' }, administrator)
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'replacement-password')
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    saveMfaSetup(user.id, encryptMfaSecret(secret))
    vi.useFakeTimers()
    vi.setSystemTime(59_000)

    const { recoveryCodes } = await userService.confirmMfaSetup(user.id, '287082')
    expect(revokeViewerSessionsForUsers).toHaveBeenLastCalledWith([user.id], expect.any(AbortSignal))

    await expect(userService.verifyPrimaryCredentials('user', 'replacement-password')).resolves.toMatchObject({
      mfaRequired: true
    })
    await expect(userService.authenticate('user', 'replacement-password')).resolves.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password', '287082')).resolves.not.toBeNull()
    const concurrent = await Promise.all([
      userService.authenticate('user', 'replacement-password', recoveryCodes[0]),
      userService.authenticate('user', 'replacement-password', recoveryCodes[0])
    ])
    expect(concurrent.filter(Boolean)).toHaveLength(1)
    await expect(userService.authenticate('user', 'replacement-password', recoveryCodes[0])).resolves.toBeNull()
    await expect(userService.getUserById(user.id)).resolves.toMatchObject({ mfaEnabled: true })
  })
})
