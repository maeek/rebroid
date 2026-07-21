import { describe, expect, it } from 'vitest'
import { buildGroupUpdateInput, toGroupDraft, type GroupDraft } from './group-edit-page-model'
import type { UserGroup } from '@/shared/contracts/auth-user'

const group: UserGroup = {
  id: 'operators',
  name: 'Operators',
  description: 'Runtime operators',
  role: 'user',
  permissions: {
    'applications:start': true,
    'automations:run': true
  },
  quotas: {
    maxOpenApps: 4,
    maxSessionSeconds: 7200,
    maxMemoryMb: 4096,
    maxCpuCpus: 4
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
}

const draft: GroupDraft = {
  name: 'Operators',
  description: 'Runtime operators',
  role: 'user',
  permissions: {
    'applications:start': true
  },
  quotas: {
    maxOpenApps: 2
  }
}

describe('group edit page model', () => {
  it('creates an editable group draft from the server group', () => {
    expect(toGroupDraft(group)).toEqual({
      name: 'Operators',
      description: 'Runtime operators',
      role: 'user',
      permissions: {
        'applications:start': true,
        'automations:run': true
      },
      quotas: {
        maxOpenApps: 4,
        maxSessionSeconds: 7200,
        maxMemoryMb: 4096,
        maxCpuCpus: 4
      }
    })
  })

  it('builds the group update payload from editable fields only', () => {
    expect(buildGroupUpdateInput(draft)).toEqual({
      name: 'Operators',
      description: 'Runtime operators',
      role: 'user',
      permissions: {
        'applications:start': true
      },
      quotas: {
        maxOpenApps: 2
      }
    })
  })
})
