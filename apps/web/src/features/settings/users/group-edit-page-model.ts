import type { UserGroup } from '@/shared/contracts/auth-user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

export type GroupDraft = {
  name: string
  description: string
  permissions: PermissionMap
  quotas: Partial<ResourceQuota>
}

type GroupUpdateInput = Pick<GroupDraft, 'name' | 'description' | 'permissions' | 'quotas'>

export const toGroupDraft = (group: UserGroup): GroupDraft => ({
  name: group.name,
  description: group.description,
  permissions: group.permissions,
  quotas: group.quotas
})

export const buildGroupUpdateInput = (draft: GroupDraft): GroupUpdateInput => ({
  name: draft.name,
  description: draft.description,
  permissions: draft.permissions,
  quotas: draft.quotas
})
