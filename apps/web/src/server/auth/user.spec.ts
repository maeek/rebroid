import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabaseForTests } from '@/server/persistence/database'
import { hasPendingViewerRevocation } from '@/server/persistence/web-maintenance-repository'
import { revokeViewerSessionsForUsers } from '@/server/users/revoke-viewer-sessions'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import { encryptMfaSecret } from './mfa-crypto'
import { completeTestAdministratorSetup } from './test-administrator'
import { userService } from './user'
import { mutateUsersFile } from './user-store'

vi.mock('@/server/users/revoke-viewer-sessions', () => ({ revokeViewerSessionsForUsers: vi.fn() }))

describe('userService.changeOwnPassword', () => {
  let tempDirectory: string
  let adminSetup: ReturnType<typeof completeTestAdministratorSetup> | undefined
  const administrator = () => (adminSetup ??= completeTestAdministratorSetup())
  const createUser = async (input: Parameters<typeof userService.createUser>[0]) =>
    userService.createUser(input, await administrator())

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'rebroid-users-'))
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'web.sqlite')
    process.env.INITIAL_ADMIN_PASSWORD = 'initial-admin-password'
    adminSetup = undefined
    vi.mocked(revokeViewerSessionsForUsers).mockReset().mockResolvedValue(undefined)
  })

  afterEach(async () => {
    delete process.env.WEB_DATABASE_PATH
    delete process.env.INITIAL_ADMIN_PASSWORD
    resetDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('requires the current password without changing the existing login', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'temporary-cleared')

    await expect(userService.changeOwnPassword(user.id, 'wrong-password', 'replacement-password')).rejects.toThrow(
      'Current password is incorrect.'
    )
    await expect(userService.authenticate('user', 'temporary-cleared')).resolves.not.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.toBeNull()
  })

  it('rejects a short replacement password', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })

    await expect(userService.changeOwnPassword(user.id, 'original-password', 'short')).rejects.toThrow(
      'Password must be at least 8 characters.'
    )
  })

  it('persists a zero minimum and accepts short credentials while requiring a password', async () => {
    const admin = await administrator()
    await expect(saveWebSettings({ passwordMinimumLength: 0 })).resolves.toMatchObject({ passwordMinimumLength: 0 })
    await saveWebSettings({ removeDataOnDelete: false })
    await expect(getWebSettings()).resolves.toMatchObject({ passwordMinimumLength: 0 })

    await expect(createUser({ username: 'empty', password: '' })).rejects.toThrow('Password is required.')
    const user = await createUser({ username: 'user', password: 'a' })
    await userService.completeRequiredPasswordChange(user.id, 'a', 'b')
    await expect(userService.changeOwnPassword(user.id, 'b', '')).rejects.toThrow('Password is required.')
    await userService.changeOwnPassword(user.id, 'b', 'c')
    await userService.updateUser(user.id, { password: 'd' }, admin)
    await expect(userService.authenticate('user', 'd')).resolves.toMatchObject({ passwordChangeRequired: true })
  })

  it('rejects invalid password policy values without replacing the saved minimum', async () => {
    await saveWebSettings({ passwordMinimumLength: 12 })
    for (const value of [undefined, null, '', '0', -1, 0.5, 129]) {
      await expect(saveWebSettings({ passwordMinimumLength: value as number })).rejects.toMatchObject({
        code: 'validation',
        status: 422
      })
    }
    await expect(getWebSettings()).resolves.toMatchObject({ passwordMinimumLength: 12 })
  })

  it('rejects passwords longer than the policy maximum', async () => {
    await expect(createUser({ username: 'user', password: 'a'.repeat(129) })).rejects.toThrow(
      'Password must not exceed 128 characters.'
    )
  })

  it('changes the password and invalidates existing sessions', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })
    const readyUser = await userService.completeRequiredPasswordChange(
      user.id,
      'original-password',
      'temporary-cleared'
    )

    vi.mocked(revokeViewerSessionsForUsers).mockRejectedValueOnce(new Error('sidecar unavailable'))
    await userService.changeOwnPassword(user.id, 'temporary-cleared', 'replacement-password')
    expect(revokeViewerSessionsForUsers).toHaveBeenLastCalledWith([user.id], expect.any(AbortSignal))
    expect(hasPendingViewerRevocation(user.id)).toBe(true)

    await expect(userService.authenticate('user', 'temporary-cleared')).resolves.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.not.toBeNull()
    await expect(userService.getUserById(user.id)).resolves.toMatchObject({
      sessionVersion: readyUser.sessionVersion + 1,
      passwordChangeRequired: false
    })
  })

  it('marks admin-created users and the bootstrap admin for password change', async () => {
    const admin = await userService.authenticate('admin', 'initial-admin-password')
    const user = await createUser({ username: 'user', password: 'original-password' })

    expect(admin).toMatchObject({ passwordChangeRequired: true })
    expect(user).toMatchObject({ passwordChangeRequired: true })
    await expect(userService.authenticate('user', 'original-password')).resolves.toMatchObject({
      passwordChangeRequired: true
    })
  })

  it('allows a short temporary bootstrap password because first-login replacement is mandatory', async () => {
    process.env.INITIAL_ADMIN_PASSWORD = 'admin'

    await expect(userService.authenticate('admin', 'admin')).resolves.toMatchObject({
      passwordChangeRequired: true
    })
  })

  it('completes a required password change and invalidates provisional sessions', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })

    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'replacement-password')

    await expect(userService.authenticate('user', 'original-password')).resolves.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.toMatchObject({
      passwordChangeRequired: false,
      sessionVersion: user.sessionVersion + 1
    })
    await expect(userService.getUserById(user.id)).resolves.toMatchObject({
      passwordChangeRequired: false,
      sessionVersion: user.sessionVersion + 1
    })
  })

  it('requires the forced replacement password to differ from the temporary password', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })

    await expect(
      userService.completeRequiredPasswordChange(user.id, 'original-password', 'original-password')
    ).rejects.toThrow('New password must be different from the current password.')
  })

  it('requires an active password-change flag for the forced-change completion flow', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'replacement-password')

    await expect(
      userService.completeRequiredPasswordChange(user.id, 'replacement-password', 'another-password')
    ).rejects.toThrow('Password change is not required for this account.')
  })

  it('preserves concurrent user creations', async () => {
    await Promise.all([
      createUser({ username: 'user-one', password: 'original-password' }),
      createUser({ username: 'user-two', password: 'original-password' })
    ])

    await expect(userService.listUsers()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: 'user-one' }),
        expect.objectContaining({ username: 'user-two' })
      ])
    )
  })

  it('reveals MFA requirements only after valid primary credentials', async () => {
    await createUser({ username: 'user', password: 'original-password' })

    await expect(userService.verifyPrimaryCredentials('user', 'wrong-password')).resolves.toBeNull()
    await expect(userService.verifyPrimaryCredentials('user', 'original-password')).resolves.toMatchObject({
      mfaRequired: false
    })
  })

  it('consumes a valid TOTP code once even across concurrent sign-ins', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })
    vi.stubEnv('MFA_ENCRYPTION_KEY', 'mfa-encryption-key-for-test-only-32-characters')
    const clock = vi.spyOn(Date, 'now').mockReturnValue(59_000)
    try {
      await mutateUsersFile(file => {
        const stored = file.users.find(entry => entry.id === user.id)!
        stored.mfaSecretEncrypted = encryptMfaSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
      })
      const results = await Promise.all([
        userService.authenticate('user', 'original-password', '287082'),
        userService.authenticate('user', 'original-password', '287 082')
      ])
      expect(results.filter(result => result?.id === user.id)).toHaveLength(1)
      expect(results.filter(result => result === null)).toHaveLength(1)
    } finally {
      clock.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  it('updates and authenticates the stored accent color', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })

    await userService.updateOwnProfile(user.id, { accentColor: 'purple' })

    await expect(userService.getUserById(user.id)).resolves.toMatchObject({ accentColor: 'purple' })
    await expect(userService.authenticate('user', 'original-password')).resolves.toMatchObject({
      accentColor: 'purple'
    })
  })

  it('requires password change after an admin reset', async () => {
    const user = await createUser({ username: 'user', password: 'original-password' })
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'replacement-password')

    await userService.updateUser(user.id, { password: 'reset-password-1' }, await administrator())

    await expect(userService.authenticate('user', 'reset-password-1')).resolves.toMatchObject({
      passwordChangeRequired: true
    })
  })

  it('protects the last enabled Administrators member from removal, disabling, and deletion', async () => {
    const expected = 'At least one enabled account must belong to Administrators.'
    await expect(userService.updateUser('admin', { groupIds: ['users'] }, await administrator())).rejects.toThrow(
      expected
    )
    await expect(userService.setUserDisabled('admin', true, await administrator())).rejects.toThrow(expected)
    await expect(userService.deleteUser('admin', await administrator())).rejects.toThrow(expected)
    await expect(userService.deleteGroup('admins', await administrator())).rejects.toThrow(
      'Built-in groups cannot be deleted.'
    )
    await expect(userService.deleteGroup('users', await administrator())).rejects.toThrow(
      'Built-in groups cannot be deleted.'
    )

    const otherAdmin = await createUser({
      username: 'second',
      password: 'original-password',
      groupIds: ['admins']
    })
    expect(otherAdmin.isPlatformAdmin).toBe(true)
    await expect(
      userService.updateUser('admin', { groupIds: ['users'] }, await administrator())
    ).resolves.toMatchObject({
      value: { isPlatformAdmin: false }
    })
  })

  it('persists permission precedence when a user reorders the same groups', async () => {
    const allow = await userService.createGroup(
      { name: 'Allow', permissions: { 'applications:start': true } },
      await administrator()
    )
    const deny = await userService.createGroup(
      { name: 'Deny', permissions: { 'applications:start': false } },
      await administrator()
    )
    const user = await createUser({
      username: 'operator',
      password: 'original-password',
      groupIds: [allow.id, deny.id]
    })
    expect(user.effectivePermissions['applications:start']).toBe(false)

    const groupIds = [deny.id, allow.id]
    const { value: updated } = await userService.updateUser(user.id, { groupIds }, await administrator())
    expect(updated.effectivePermissions['applications:start']).toBe(true)
    expect(await userService.getUserById(user.id)).toMatchObject({
      groupIds,
      effectivePermissions: { 'applications:start': true }
    })
  })

  it('revokes actual members on group edits and leaves removed memberships without implicit viewer access', async () => {
    const group = await userService.createGroup(
      {
        name: 'Operators',
        permissions: { 'applications:control-viewer': true }
      },
      await administrator()
    )
    const operator = await createUser({
      username: 'operator',
      password: 'original-password',
      groupIds: [group.id]
    })
    const defaultUser = await createUser({ username: 'default-user', password: 'original-password' })
    await userService.deleteGroup(group.id, await administrator())
    expect(revokeViewerSessionsForUsers).toHaveBeenLastCalledWith([operator.id], expect.any(AbortSignal))
    expect(await userService.getUserById(operator.id)).toMatchObject({ groupIds: [], effectivePermissions: {} })

    await userService.updateGroup('users', { permissions: {} }, await administrator())
    expect(revokeViewerSessionsForUsers).toHaveBeenLastCalledWith([defaultUser.id], expect.any(AbortSignal))
    expect(
      (await userService.getUserById(defaultUser.id))?.effectivePermissions['applications:control-viewer']
    ).toBeUndefined()
  })
})
