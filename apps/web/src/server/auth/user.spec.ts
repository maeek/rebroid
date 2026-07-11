import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDatabaseForTests } from '@/server/persistence/database'
import { userService } from './user'

describe('userService.changeOwnPassword', () => {
  let tempDirectory: string

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'rebroid-users-'))
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'web.sqlite')
    process.env.INITIAL_ADMIN_PASSWORD = 'initial-admin-password'
  })

  afterEach(async () => {
    delete process.env.WEB_DATABASE_PATH
    delete process.env.INITIAL_ADMIN_PASSWORD
    resetDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('requires the current password without changing the existing login', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'temporary-cleared')

    await expect(userService.changeOwnPassword(user.id, 'wrong-password', 'replacement-password')).rejects.toThrow(
      'Current password is incorrect.'
    )
    await expect(userService.authenticate('user', 'temporary-cleared')).resolves.not.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.toBeNull()
  })

  it('rejects a short replacement password', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    await expect(userService.changeOwnPassword(user.id, 'original-password', 'too-short')).rejects.toThrow(
      'Password must be at least 15 characters.'
    )
  })

  it('rejects passwords longer than the policy maximum', async () => {
    await expect(userService.createUser({ username: 'user', password: 'a'.repeat(129) })).rejects.toThrow(
      'Password must not exceed 128 characters.'
    )
  })

  it('changes the password and invalidates existing sessions', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })
    const readyUser = await userService.completeRequiredPasswordChange(
      user.id,
      'original-password',
      'temporary-cleared'
    )

    await userService.changeOwnPassword(user.id, 'temporary-cleared', 'replacement-password')

    await expect(userService.authenticate('user', 'temporary-cleared')).resolves.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.not.toBeNull()
    await expect(userService.getUserById(user.id)).resolves.toMatchObject({
      sessionVersion: readyUser.sessionVersion + 1,
      passwordChangeRequired: false
    })
  })

  it('marks admin-created users and the bootstrap admin for password change', async () => {
    const admin = await userService.authenticate('admin', 'initial-admin-password')
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    expect(admin).toMatchObject({ passwordChangeRequired: true })
    expect(user).toMatchObject({ passwordChangeRequired: true })
    await expect(userService.authenticate('user', 'original-password')).resolves.toMatchObject({
      passwordChangeRequired: true
    })
  })

  it('completes a required password change and invalidates provisional sessions', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

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
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    await expect(
      userService.completeRequiredPasswordChange(user.id, 'original-password', 'original-password')
    ).rejects.toThrow('New password must be different from the current password.')
  })

  it('requires an active password-change flag for the forced-change completion flow', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'replacement-password')

    await expect(
      userService.completeRequiredPasswordChange(user.id, 'replacement-password', 'another-password')
    ).rejects.toThrow('Password change is not required for this account.')
  })

  it('preserves concurrent user creations', async () => {
    await Promise.all([
      userService.createUser({ username: 'user-one', password: 'original-password' }),
      userService.createUser({ username: 'user-two', password: 'original-password' })
    ])

    await expect(userService.listUsers()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: 'user-one' }),
        expect.objectContaining({ username: 'user-two' })
      ])
    )
  })

  it('reveals MFA requirements only after valid primary credentials', async () => {
    await userService.createUser({ username: 'user', password: 'original-password' })

    await expect(userService.verifyPrimaryCredentials('user', 'wrong-password')).resolves.toBeNull()
    await expect(userService.verifyPrimaryCredentials('user', 'original-password')).resolves.toMatchObject({
      mfaRequired: false
    })
  })

  it('updates and authenticates the stored accent color', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    await userService.updateUser(user.id, { accentColor: 'purple' })

    await expect(userService.getUserById(user.id)).resolves.toMatchObject({ accentColor: 'purple' })
    await expect(userService.authenticate('user', 'original-password')).resolves.toMatchObject({
      accentColor: 'purple'
    })
  })

  it('requires password change after an admin reset', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })
    await userService.completeRequiredPasswordChange(user.id, 'original-password', 'replacement-password')

    await userService.resetPassword(user.id, 'reset-password-1')

    await expect(userService.authenticate('user', 'reset-password-1')).resolves.toMatchObject({
      passwordChangeRequired: true
    })
  })

  it('does not allow the last active administrator to be demoted', async () => {
    await expect(userService.updateUser('admin', { role: 'user' })).rejects.toThrow(
      'Cannot remove or disable the last active admin.'
    )
  })
})
