import { describe, expect, it } from 'vitest'
import { buildUserUpdateInput, toUserDraft, type UserDraft } from './user-edit-page-model'
import type { PublicUser } from '@/shared/contracts/auth-user'

const baseUser: PublicUser = {
  id: 'user-1',
  username: 'ada',
  name: 'Ada Lovelace',
  isPlatformAdmin: false,
  groupIds: ['operators'],
  disabled: false,
  passwordChangeRequired: false,
  mfaEnabled: false,
  sessionVersion: 1,
  avatarDataUrl: 'data:image/png;base64,avatar',
  accentColor: 'blue',
  effectivePermissions: {},
  effectiveQuotas: {
    maxOpenApps: 3,
    maxSessionSeconds: 3600,
    maxMemoryMb: 2048,
    maxCpuCpus: 2
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
}

const baseDraft: UserDraft = {
  username: 'ada',
  name: 'Ada Lovelace',
  password: '',
  groupIds: ['operators'],
  disabled: false,
  avatarDataUrl: null
}

describe('user edit page model', () => {
  it('creates an editable draft without carrying the password', () => {
    expect(toUserDraft(baseUser)).toEqual({
      username: 'ada',
      name: 'Ada Lovelace',
      password: '',
      groupIds: ['operators'],
      disabled: false,
      avatarDataUrl: 'data:image/png;base64,avatar'
    })
  })

  it('omits blank passwords from update input', () => {
    expect(buildUserUpdateInput(baseDraft)).toMatchObject({
      username: 'ada',
      password: undefined,
      groupIds: ['operators']
    })
  })

  it('keeps a non-empty password in update input', () => {
    expect(buildUserUpdateInput({ ...baseDraft, password: 'new-password' }).password).toBe('new-password')
  })
})
