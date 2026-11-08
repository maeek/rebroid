import { describe, expect, it } from 'vitest'
import {
  buildUserUpdateInput,
  getPermissionInheritanceMap,
  toUserDraft,
  toUserRole,
  type UserDraft
} from './user-edit-page-model'
import type { PublicUser, UserGroup } from '@/shared/contracts/auth-user'

const baseUser: PublicUser = {
  id: 'user-1',
  username: 'ada',
  name: 'Ada Lovelace',
  role: 'user',
  groupIds: ['operators'],
  disabled: false,
  passwordChangeRequired: false,
  mfaEnabled: false,
  sessionVersion: 1,
  avatarDataUrl: 'data:image/png;base64,avatar',
  accentColor: 'blue',
  permissionOverrides: {
    'applications:create': true
  },
  effectivePermissions: {},
  quotas: {
    maxOpenApps: 3
  },
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
  role: 'user',
  groupIds: ['operators'],
  disabled: false,
  avatarDataUrl: null,
  permissionOverrides: {},
  quotas: {}
}

const groups: UserGroup[] = [
  {
    id: 'operators',
    name: 'Operators',
    description: 'Runtime operators',
    role: 'user',
    permissions: {
      'applications:start': true,
      'applications:create': true
    },
    quotas: {
      maxOpenApps: 2,
      maxSessionSeconds: 3600,
      maxMemoryMb: 2048,
      maxCpuCpus: 2
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'auditors',
    name: 'Auditors',
    description: 'Audit viewers',
    role: 'user',
    permissions: {
      'applications:view-logs': true,
      'applications:start': true
    },
    quotas: {
      maxOpenApps: 2,
      maxSessionSeconds: 3600,
      maxMemoryMb: 2048,
      maxCpuCpus: 2
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
]

describe('user edit page model', () => {
  it('creates an editable draft without carrying the password', () => {
    expect(toUserDraft(baseUser)).toEqual({
      username: 'ada',
      name: 'Ada Lovelace',
      password: '',
      role: 'user',
      groupIds: ['operators'],
      disabled: false,
      avatarDataUrl: 'data:image/png;base64,avatar',
      permissionOverrides: {
        'applications:create': true
      },
      quotas: {
        maxOpenApps: 3
      }
    })
  })

  it('omits blank passwords from update input', () => {
    expect(buildUserUpdateInput(baseDraft)).toMatchObject({
      username: 'ada',
      password: undefined,
      role: 'user',
      groupIds: ['operators']
    })
  })

  it('keeps a non-empty password in update input', () => {
    expect(buildUserUpdateInput({ ...baseDraft, password: 'new-password' }).password).toBe('new-password')
  })

  it('coerces unknown role select values to user', () => {
    expect(toUserRole('admin')).toBe('admin')
    expect(toUserRole('owner')).toBe('user')
  })

  it('maps inherited group permissions by selected groups', () => {
    expect(getPermissionInheritanceMap(groups, ['operators', 'auditors'], 'user')).toMatchObject({
      'applications:start': { allowed: true, source: 'Auditors' },
      'applications:create': { allowed: true, source: 'Operators' },
      'applications:view-logs': { allowed: true, source: 'Auditors' }
    })
  })

  it('follows selected group order and preserves explicit denials', () => {
    const conflicting = [groups[0], { ...groups[1], permissions: { 'applications:start': false } }]
    expect(getPermissionInheritanceMap(conflicting, ['operators', 'auditors'], 'user')['applications:start']).toEqual({
      allowed: false,
      source: 'Auditors'
    })
    expect(getPermissionInheritanceMap(conflicting, ['auditors', 'operators'], 'user')['applications:start']).toEqual({
      allowed: true,
      source: 'Operators'
    })
  })

  it('uses the same fallback group as the server when membership is empty or missing', () => {
    expect(getPermissionInheritanceMap(groups, [], 'user')['applications:start']).toEqual({
      allowed: true,
      source: 'Operators'
    })
    expect(getPermissionInheritanceMap(groups, ['deleted'], 'user')['applications:start']).toEqual({
      allowed: true,
      source: 'Operators'
    })
  })

  it('marks admin role permissions as inherited when no selected group grants them', () => {
    const inheritance = getPermissionInheritanceMap(groups, [], 'admin')

    expect(inheritance['applications:start']).toEqual({ allowed: true, source: 'Admin role' })
    expect(inheritance['automations:manage-ai-providers']).toEqual({ allowed: true, source: 'Admin role' })
  })
})
