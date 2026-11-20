import { describe, expect, it } from 'vitest'
import { defaultUserQuota } from '@/shared/permissions/permissions'
import { buildResourceLimitBounds } from './resource-limits'

describe('buildResourceLimitBounds', () => {
  it('returns host totals alongside the effective account bounds', () => {
    const capacity = { hostMemoryBytes: 32 * 1024 ** 3, hostCpuCores: 8 }
    expect(buildResourceLimitBounds(capacity, defaultUserQuota)).toEqual({
      ...capacity,
      maxMemoryMb: 2048,
      maxCpuCpus: 2
    })
  })

  it('returns the account bounds when the host capacity cannot be read', () => {
    expect(buildResourceLimitBounds(null, defaultUserQuota)).toEqual({
      hostMemoryBytes: null,
      hostCpuCores: null,
      maxMemoryMb: 2048,
      maxCpuCpus: 2
    })
  })
})
