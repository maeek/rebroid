import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { corruptWebStateForTests, resetWebDatabaseForTests } from '@/server/storage/database'
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
    resetWebDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('requires the current password without changing the existing login', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    await expect(userService.changeOwnPassword(user.id, 'wrong-password', 'replacement-password')).rejects.toThrow(
      'Current password is incorrect.'
    )
    await expect(userService.authenticate('user', 'original-password')).resolves.not.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.toBeNull()
  })

  it('rejects a short replacement password', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    await expect(userService.changeOwnPassword(user.id, 'original-password', 'too-short')).rejects.toThrow(
      'Password must be at least 12 characters.'
    )
  })

  it('changes the password and invalidates existing sessions', async () => {
    const user = await userService.createUser({ username: 'user', password: 'original-password' })

    await userService.changeOwnPassword(user.id, 'original-password', 'replacement-password')

    await expect(userService.authenticate('user', 'original-password')).resolves.toBeNull()
    await expect(userService.authenticate('user', 'replacement-password')).resolves.not.toBeNull()
    await expect(userService.getUserById(user.id)).resolves.toMatchObject({ sessionVersion: user.sessionVersion + 1 })
  })

  it('fails closed when the users state is malformed', async () => {
    corruptWebStateForTests('users', '{malformed')

    await expect(userService.listUsers()).rejects.toThrow()
    await expect(userService.authenticate('admin', 'initial-admin-password')).rejects.toThrow()
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
})
