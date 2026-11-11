import { describe, expect, it } from 'vitest'
import { defaultGroups, toPublicUser, validateAvatarDataUrl, validateGroupIds } from './user-model'
import type { StoredUser, UsersFile } from './user-model'

const storedUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  id: 'user-1',
  username: 'user',
  name: 'User',
  groupIds: ['users'],
  disabled: false,
  passwordChangeRequired: false,
  sessionVersion: 1,
  avatarDataUrl: null,
  accentColor: 'blue',
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
  it('derives public users with effective permissions and quotas', () => {
    const user = storedUser()
    const publicUser = toPublicUser(usersFile(user), user)

    expect(publicUser).toMatchObject({
      id: 'user-1',
      accentColor: 'blue',
      groupIds: ['users'],
      effectiveQuotas: { maxOpenApps: 2 },
      isPlatformAdmin: false
    })
    expect('passwordHash' in publicUser).toBe(false)
  })

  it('accepts only existing group IDs and preserves their order', () => {
    const { groups } = usersFile()
    expect(validateGroupIds(groups, ['users', 'admins', 'users'])).toEqual(['users', 'admins'])
    expect(validateGroupIds(groups, [])).toEqual([])
    expect(() => validateGroupIds(groups, ['missing'])).toThrow('Select existing groups.')
  })

  it('validates supported bounded avatar data URLs', () => {
    expect(() => validateAvatarDataUrl('data:image/png;base64,AA==')).not.toThrow()
    expect(() => validateAvatarDataUrl('data:text/plain;base64,AA==')).toThrow(
      'Avatar must be a PNG, JPEG, or WebP image no larger than 2 MB.'
    )
  })
})
