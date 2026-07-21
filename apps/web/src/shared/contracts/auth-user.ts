import type { AccentColor } from '@/shared/model/theme/accent-color'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

export type UserRole = 'admin' | 'user'

export interface UserGroup {
  id: string
  name: string
  description: string
  role: UserRole
  permissions: PermissionMap
  quotas: ResourceQuota
  createdAt: string
  updatedAt: string
}

export interface PublicUser {
  id: string
  username: string
  name: string
  role: UserRole
  groupIds: string[]
  disabled: boolean
  passwordChangeRequired: boolean
  mfaEnabled: boolean
  sessionVersion: number
  avatarDataUrl: string | null
  accentColor: AccentColor
  permissionOverrides: PermissionMap
  effectivePermissions: PermissionMap
  quotas: Partial<ResourceQuota>
  effectiveQuotas: ResourceQuota
  createdAt: string
  updatedAt: string
}

export interface UserEditorInput {
  username?: string
  name?: string
  password?: string
  role?: UserRole
  groupIds?: string[]
  disabled?: boolean
  avatarDataUrl?: string | null
  accentColor?: AccentColor
  permissionOverrides?: PermissionMap
  quotas?: Partial<ResourceQuota>
}
