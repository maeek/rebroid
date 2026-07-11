import { describe, expect, it } from 'vitest'
import {
  defaultGroups,
  findGroups,
  normalizeGroups,
  normalizeUser,
  toPublicUser,
  validateAvatarDataUrl
} from './user-model'
import type { StoredUser, UsersFile } from './user-model'

const storedUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  id: 'user-1',
  username: 'user',
  name: 'User',
  role: 'user',
  groupIds: ['users'],
  disabled: false,
  passwordChangeRequired: false,
  sessionVersion: 1,
  avatarDataUrl: null,
  accentColor: 'blue',
  permissionOverrides: {},
  quotas: {},
  passwordHash: '$2hash',
  mfaSecretEncrypted: null,
  mfaRecoveryCodeHashes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

const usersFile = (user: StoredUser = storedUser()): UsersFile => ({
  users: [user],
  groups: defaultGroups()
})

describe('user model', () => {
  it('falls back to the role group when selected groups are missing', () => {
    const file = usersFile(storedUser({ groupIds: ['missing'] }))

    expect(findGroups(file, ['missing'], 'user').map(group => group.id)).toEqual(['users'])
  })

  it('derives public users with effective permissions and quotas', () => {
    const user = storedUser({ quotas: { maxOpenApps: 3 } })
    const publicUser = toPublicUser(usersFile(user), user)

    expect(publicUser).toMatchObject({
      id: 'user-1',
      accentColor: 'blue',
      groupIds: ['users'],
      effectiveQuotas: { maxOpenApps: 3 }
    })
    expect('passwordHash' in publicUser).toBe(false)
  })

  it('normalizes partial users and groups', () => {
    expect(normalizeUser({ id: 'u1', username: 'name', passwordHash: '$2hash' })).toMatchObject({
      name: 'name',
      role: 'user',
      groupIds: ['users'],
      passwordChangeRequired: false,
      sessionVersion: 1,
      accentColor: 'blue'
    })
    expect(normalizeGroups([{ id: 'admins', name: 'Admins', role: 'admin' }])[0]).toMatchObject({
      id: 'admins',
      role: 'admin',
      description: ''
    })
  })

  it('validates supported bounded avatar data URLs', () => {
    expect(() => validateAvatarDataUrl('data:image/png;base64,AA==')).not.toThrow()
    expect(() => validateAvatarDataUrl('data:text/plain;base64,AA==')).toThrow(
      'Avatar must be a PNG, JPEG, or WebP image no larger than 2 MB.'
    )
  })
})
