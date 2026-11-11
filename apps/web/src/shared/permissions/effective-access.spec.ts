import { describe, expect, it } from 'vitest'
import { administratorsGroupId, resolveEffectiveAccess } from './effective-access'
import { defaultUserQuota, normalizeGroupQuota } from './permissions'
import type { UserGroup } from '@/shared/contracts/auth-user'

const groups: UserGroup[] = [
  {
    id: 'operators',
    name: 'Operators',
    description: 'Runtime operators',
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
    expect(resolveEffectiveAccess(groups, ['operators', 'auditors']).decisions).toMatchObject({
      'applications:start': { allowed: true, groupName: 'Auditors' },
      'applications:create': { allowed: true, groupName: 'Operators' },
      'applications:view-logs': { allowed: true, groupName: 'Auditors' }
    })
  })

  it('follows selected group order and preserves explicit denials', () => {
    const conflicting = [groups[0], { ...groups[1], permissions: { 'applications:start': false } }]
    expect(resolveEffectiveAccess(conflicting, ['operators', 'auditors']).decisions['applications:start']).toEqual({
      allowed: false,
      groupName: 'Auditors'
    })
    expect(resolveEffectiveAccess(conflicting, ['auditors', 'operators']).decisions['applications:start']).toEqual({
      allowed: true,
      groupName: 'Operators'
    })
  })

  it('leaves empty and missing memberships without a grant', () => {
    expect(resolveEffectiveAccess(groups, []).decisions).toEqual({})
    expect(resolveEffectiveAccess(groups, ['deleted']).decisions).toEqual({})
    expect(resolveEffectiveAccess(groups, ['deleted']).quotas).toEqual(defaultUserQuota)
  })

  it('uses the final resolved group’s entire quota profile, including unlimited fields', () => {
    const operators = { ...groups[0], quotas: normalizeGroupQuota({ maxMemoryMb: 4096, maxCpuCpus: 4 }) }
    const auditors = { ...groups[1], quotas: normalizeGroupQuota({ maxOpenApps: null }) }
    expect(resolveEffectiveAccess([operators, auditors], ['operators', 'auditors', 'missing']).quotas).toEqual({
      ...defaultUserQuota,
      maxOpenApps: null
    })
    expect(resolveEffectiveAccess([operators, auditors], ['auditors', 'operators']).quotas).toEqual(operators.quotas)
  })

  it('gives the built-in Administrators group full access independent of group order', () => {
    const adminGroup = { ...groups[0], id: administratorsGroupId, name: 'Administrators' }
    const other = { ...groups[1], permissions: { 'applications:start': false } }
    const access = resolveEffectiveAccess([adminGroup, other], [administratorsGroupId, other.id])
    expect(access.isPlatformAdmin).toBe(true)
    expect(access.decisions['applications:start']).toEqual({ allowed: true, groupName: 'Administrators' })
    expect(access.quotas).toEqual({ maxOpenApps: null, maxSessionSeconds: null, maxMemoryMb: null, maxCpuCpus: null })
    expect(resolveEffectiveAccess([adminGroup, other], [other.id]).isPlatformAdmin).toBe(false)
  })
})
