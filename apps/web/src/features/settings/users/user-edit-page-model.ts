import { allPermissionIds, type PermissionMap, type ResourceQuota } from '@/shared/permissions/permissions'
import type { PermissionInheritanceMap } from './components/permission-switch-table'
import type { PublicUser, UserEditorInput, UserGroup, UserRole } from '@/shared/contracts/auth-user'

export type UserDraft = {
  username: string
  name: string
  password: string
  role: UserRole
  groupIds: string[]
  disabled: boolean
  avatarDataUrl: string | null
  permissionOverrides: PermissionMap
  quotas: Partial<ResourceQuota>
}

export const toUserDraft = (user: PublicUser): UserDraft => ({
  username: user.username,
  name: user.name,
  password: '',
  role: user.role,
  groupIds: user.groupIds,
  disabled: user.disabled,
  avatarDataUrl: user.avatarDataUrl,
  permissionOverrides: user.permissionOverrides,
  quotas: user.quotas
})

export const toUserRole = (value: string): UserRole => (value === 'admin' ? 'admin' : 'user')

export const buildUserUpdateInput = (draft: UserDraft): UserEditorInput => ({
  username: draft.username,
  name: draft.name,
  password: draft.password || undefined,
  role: draft.role,
  groupIds: draft.groupIds,
  disabled: draft.disabled,
  avatarDataUrl: draft.avatarDataUrl,
  permissionOverrides: draft.permissionOverrides,
  quotas: draft.quotas
})

export const getPermissionInheritanceMap = (
  groups: UserGroup[],
  groupIds: string[],
  role: UserRole
): PermissionInheritanceMap => {
  const assignedGroups = groups.filter(group => groupIds.includes(group.id))

  return allPermissionIds.reduce<PermissionInheritanceMap>((inheritance, permissionId) => {
    const inheritedFrom = assignedGroups
      .filter(group => group.permissions[permissionId] === true)
      .map(group => group.name)

    if (role === 'admin' && inheritedFrom.length === 0) {
      inheritedFrom.push('Admin role')
    }

    if (inheritedFrom.length > 0) {
      inheritance[permissionId] = inheritedFrom
    }

    return inheritance
  }, {})
}
