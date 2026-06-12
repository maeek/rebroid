import type { UserGroup, UserRole } from '@/server/auth/user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

export type GroupDraft = {
  name: string
  description: string
  role: UserRole
  permissions: PermissionMap
  quotas: Partial<ResourceQuota>
}

type GroupUpdateInput = Pick<GroupDraft, 'name' | 'description' | 'role' | 'permissions' | 'quotas'>

export const toGroupDraft = (group: UserGroup): GroupDraft => ({
  name: group.name,
  description: group.description,
  role: group.role,
  permissions: group.permissions,
  quotas: group.quotas
})

export const buildGroupUpdateInput = (draft: GroupDraft): GroupUpdateInput => ({
  name: draft.name,
  description: draft.description,
  role: draft.role,
  permissions: draft.permissions,
  quotas: draft.quotas
})
