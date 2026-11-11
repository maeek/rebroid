import type { AccentColor } from '@/shared/model/theme/accent-color'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

export interface UserGroup {
  id: string
  name: string
  description: string
  permissions: PermissionMap
  quotas: ResourceQuota
  createdAt: string
  updatedAt: string
}

export type CreateUserGroupInput = {
  name: string
  description: string
  quotas: Partial<ResourceQuota>
  permissions: PermissionMap
}

export interface PublicUser {
  id: string
  username: string
  name: string
  isPlatformAdmin: boolean
  groupIds: string[]
  disabled: boolean
  passwordChangeRequired: boolean
  mfaEnabled: boolean
  sessionVersion: number
  avatarDataUrl: string | null
  accentColor: AccentColor
  effectivePermissions: PermissionMap
  effectiveQuotas: ResourceQuota
  createdAt: string
  updatedAt: string
}

export interface UserEditorInput {
  username?: string
  name?: string
  password?: string
  groupIds?: string[]
  disabled?: boolean
  avatarDataUrl?: string | null
  accentColor?: AccentColor
}
