import {
  defaultUserPermissions,
  defaultUserQuota,
  fullPermissions,
  mergePermissions,
  mergeQuotas,
  unlimitedQuota,
  type PermissionMap,
  type ResourceQuota
} from '@/shared/permissions/permissions'

export type UserRole = 'admin' | 'user'

export type UserGroup = {
  id: string
  name: string
  description: string
  role: UserRole
  permissions: PermissionMap
  quotas: ResourceQuota
  createdAt: string
  updatedAt: string
}

export type PublicUser = {
  id: string
  username: string
  name: string
  role: UserRole
  groupIds: string[]
  disabled: boolean
  sessionVersion: number
  avatarDataUrl: string | null
  permissionOverrides: PermissionMap
  effectivePermissions: PermissionMap
  quotas: Partial<ResourceQuota>
  effectiveQuotas: ResourceQuota
  createdAt: string
  updatedAt: string
}

export type UserEditorInput = {
  username?: string
  name?: string
  password?: string
  role?: UserRole
  groupIds?: string[]
  disabled?: boolean
  avatarDataUrl?: string | null
  permissionOverrides?: PermissionMap
  quotas?: Partial<ResourceQuota>
}

export type StoredUser = Omit<PublicUser, 'effectivePermissions' | 'effectiveQuotas'> & {
  passwordHash: string
}

export type UsersFile = {
  users: StoredUser[]
  groups: UserGroup[]
}

export const minimumPasswordLength = 12

const maxAvatarBytes = 2 * 1024 * 1024

export const nowIso = () => new Date().toISOString()

export const validateAvatarDataUrl = (avatarDataUrl: string | null | undefined) => {
  if (!avatarDataUrl) {
    return
  }
  const match = avatarDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/)
  if (!match || Buffer.from(match[2], 'base64').length > maxAvatarBytes) {
    throw new Error('Avatar must be a PNG, JPEG, or WebP image no larger than 2 MB.')
  }
}

export const defaultGroups = (): UserGroup[] => {
  const now = nowIso()
  return [
    {
      id: 'admins',
      name: 'Administrators',
      description: 'Full platform access.',
      role: 'admin',
      permissions: fullPermissions,
      quotas: unlimitedQuota,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'users',
      name: 'Users',
      description: 'Standard app owners with bounded resources.',
      role: 'user',
      permissions: defaultUserPermissions,
      quotas: defaultUserQuota,
      createdAt: now,
      updatedAt: now
    }
  ]
}

export const findGroups = (file: UsersFile, groupIds: string[] | undefined, role: UserRole) => {
  const selectedGroups = groupIds
    ?.map(groupId => file.groups.find(group => group.id === groupId))
    .filter((group): group is UserGroup => Boolean(group))

  if (selectedGroups && selectedGroups.length > 0) {
    return selectedGroups
  }

  const fallbackGroup =
    file.groups.find(group => group.role === role) ?? file.groups.find(group => group.id === 'users') ?? file.groups[0]

  return fallbackGroup ? [fallbackGroup] : []
}

export const toPublicUser = (file: UsersFile, user: StoredUser): PublicUser => {
  const groups = findGroups(file, user.groupIds, user.role)
  const effectivePermissions =
    user.role === 'admin'
      ? fullPermissions
      : mergePermissions(...groups.map(group => group.permissions), user.permissionOverrides)
  const effectiveQuotas =
    user.role === 'admin' ? unlimitedQuota : mergeQuotas(...groups.map(group => group.quotas), user.quotas)

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    groupIds: groups.map(group => group.id),
    disabled: user.disabled,
    sessionVersion: user.sessionVersion,
    avatarDataUrl: user.avatarDataUrl,
    permissionOverrides: user.permissionOverrides,
    effectivePermissions,
    quotas: user.quotas,
    effectiveQuotas,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

export const normalizeUser = (
  user: Partial<StoredUser> & Pick<StoredUser, 'id' | 'username' | 'passwordHash'>
): StoredUser => {
  const now = nowIso()
  const role = user.role ?? 'user'
  const groupIds = user.groupIds ?? [role === 'admin' ? 'admins' : 'users']

  return {
    id: user.id,
    username: user.username,
    name: user.name ?? user.username,
    role,
    groupIds,
    disabled: user.disabled ?? false,
    sessionVersion: user.sessionVersion ?? 1,
    avatarDataUrl: user.avatarDataUrl ?? null,
    permissionOverrides: user.permissionOverrides ?? {},
    quotas: user.quotas ?? {},
    passwordHash: user.passwordHash,
    createdAt: user.createdAt ?? now,
    updatedAt: user.updatedAt ?? now
  }
}

export const normalizeGroups = (groups: Partial<UserGroup>[] | undefined) => {
  const sourceGroups = groups && groups.length > 0 ? groups : defaultGroups()

  return sourceGroups.map(group => {
    const role = group.role ?? 'user'

    return {
      ...group,
      id: group.id ?? role,
      name: group.name ?? role,
      description: group.description ?? '',
      role,
      permissions: role === 'admin' ? fullPermissions : (group.permissions ?? {}),
      quotas: role === 'admin' ? unlimitedQuota : mergeQuotas(group.quotas),
      createdAt: group.createdAt ?? nowIso(),
      updatedAt: group.updatedAt ?? nowIso()
    }
  })
}
