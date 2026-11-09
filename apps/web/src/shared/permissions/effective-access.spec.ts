import { describe, expect, it } from 'vitest'
import { resolveEffectiveAccess } from './effective-access'
import type { UserGroup } from '@/shared/contracts/auth-user'

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

describe('effective access', () => {
  it('maps inherited group permissions by selected groups', () => {
    expect(resolveEffectiveAccess(groups, ['operators', 'auditors'], 'user', {}).decisions).toMatchObject({
      'applications:start': { allowed: true, source: 'group', groupName: 'Auditors' },
      'applications:create': { allowed: true, source: 'group', groupName: 'Operators' },
      'applications:view-logs': { allowed: true, source: 'group', groupName: 'Auditors' }
    })
  })

  it('follows selected group order and preserves explicit denials', () => {
    const conflicting = [groups[0], { ...groups[1], permissions: { 'applications:start': false } }]
    expect(
      resolveEffectiveAccess(conflicting, ['operators', 'auditors'], 'user', {}).decisions['applications:start']
    ).toEqual({
      allowed: false,
      source: 'group',
      groupName: 'Auditors'
    })
    expect(
      resolveEffectiveAccess(conflicting, ['auditors', 'operators'], 'user', {}).decisions['applications:start']
    ).toEqual({
      allowed: true,
      source: 'group',
      groupName: 'Operators'
    })
  })

  it('uses the same fallback group as the server when membership is empty or missing', () => {
    expect(resolveEffectiveAccess(groups, [], 'user', {}).decisions['applications:start']).toEqual({
      allowed: true,
      source: 'group',
      groupName: 'Operators'
    })
    expect(resolveEffectiveAccess(groups, ['deleted'], 'user', {}).decisions['applications:start']).toEqual({
      allowed: true,
      source: 'group',
      groupName: 'Operators'
    })
  })

  it('keeps Admin access even when a user override denies it', () => {
    const inheritance = resolveEffectiveAccess(groups, [], 'admin', { 'applications:start': false }).decisions

    expect(inheritance['applications:start']).toEqual({ allowed: true, source: 'admin' })
    expect(inheritance['automations:manage-ai-providers']).toEqual({ allowed: true, source: 'admin' })
  })

  it('does not fall back to an administrator group when a user group is deleted', () => {
    const adminGroup = { ...groups[0], id: 'admins', role: 'admin' as const }
    expect(resolveEffectiveAccess([adminGroup], ['deleted'], 'user', {})).toEqual({ groups: [], decisions: {} })
  })
})
