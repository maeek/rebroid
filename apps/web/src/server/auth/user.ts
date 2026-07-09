import { randomUUID } from 'node:crypto'
import { defaultAccentColor, isAccentColor } from '@/shared/model/theme/accent-color'
import {
  defaultUserPermissions,
  fullPermissions,
  mergeQuotas,
  unlimitedQuota,
  type PermissionMap,
  type ResourceQuota
} from '@/shared/permissions/permissions'
import { hashPassword, verifyPassword } from './password-hashing'
import { assertPasswordMeetsPolicy, getPasswordMinimumLength } from './password-policy'
import { findGroups, nowIso, toPublicUser, validateAvatarDataUrl } from './user-model'
import { authenticate, getUserById, listGroups, listUsers } from './user-queries'
import { mutateUsersFile } from './user-store'
import type { StoredUser, UserEditorInput, UserGroup, UserRole, UsersFile } from './user-model'

export type { PublicUser, UserEditorInput, UserGroup, UserRole } from './user-model'

const assertCanRemoveOrDisableUser = (file: UsersFile, user: StoredUser) => {
  if (user.role !== 'admin') {
    return
  }

  const activeAdmins = file.users.filter(item => item.role === 'admin' && !item.disabled)
  if (activeAdmins.length < 2) {
    throw new Error('Cannot remove or disable the last active admin.')
  }
}

const createUser = async ({
  username,
  password,
  role = 'user',
  groupIds,
  ...input
}: UserEditorInput & { username: string; password: string }) =>
  mutateUsersFile(async file => {
    const passwordMinimumLength = await getPasswordMinimumLength()
    const normalizedUsername = username.trim()
    if (!normalizedUsername || password.length < passwordMinimumLength) {
      throw new Error(`Username is required and password must be at least ${passwordMinimumLength} characters.`)
    }
    validateAvatarDataUrl(input.avatarDataUrl)
    if (input.accentColor !== undefined && !isAccentColor(input.accentColor)) {
      throw new Error('Unsupported accent color.')
    }
    if (file.users.some(user => user.username === normalizedUsername)) {
      throw new Error('Username already exists.')
    }

    const groups = findGroups(file, groupIds, role)
    const now = nowIso()
    const user: StoredUser = {
      id: randomUUID(),
      username: normalizedUsername,
      name: input.name?.trim() || normalizedUsername,
      role,
      groupIds: groups.map(group => group.id),
      disabled: input.disabled ?? false,
      passwordChangeRequired: true,
      sessionVersion: 1,
      avatarDataUrl: input.avatarDataUrl ?? null,
      accentColor: input.accentColor ?? defaultAccentColor,
      permissionOverrides: input.permissionOverrides ?? {},
      quotas: input.quotas ?? {},
      passwordHash: await hashPassword(password),
      createdAt: now,
      updatedAt: now
    }
    file.users.push(user)
    return toPublicUser(file, user)
  })

const updateUser = async (id: string, input: UserEditorInput) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === id)
    if (!user) {
      throw new Error('User not found.')
    }

    if (input.disabled && !user.disabled) {
      assertCanRemoveOrDisableUser(file, user)
    }

    if (input.username !== undefined) {
      const username = input.username.trim()
      if (!username) {
        throw new Error('Username is required.')
      }
      if (file.users.some(item => item.id !== id && item.username === username)) {
        throw new Error('Username already exists.')
      }
      user.username = username
    }
    if (input.password !== undefined && input.password.trim()) {
      await assertPasswordMeetsPolicy(input.password)
      user.passwordHash = await hashPassword(input.password)
      user.passwordChangeRequired = true
      user.sessionVersion += 1
    }
    if (input.name !== undefined) user.name = input.name.trim() || user.username
    if (input.role !== undefined) user.role = input.role
    if (input.groupIds !== undefined) user.groupIds = findGroups(file, input.groupIds, user.role).map(group => group.id)
    if (input.disabled !== undefined && input.disabled !== user.disabled) {
      user.disabled = input.disabled
      user.sessionVersion += 1
    }
    if (input.avatarDataUrl !== undefined) {
      validateAvatarDataUrl(input.avatarDataUrl)
      user.avatarDataUrl = input.avatarDataUrl
    }
    if (input.accentColor !== undefined && !isAccentColor(input.accentColor)) {
      throw new Error('Unsupported accent color.')
    }
    if (input.accentColor !== undefined) user.accentColor = input.accentColor
    if (input.permissionOverrides !== undefined) user.permissionOverrides = input.permissionOverrides
    if (input.quotas !== undefined) user.quotas = input.quotas

    user.updatedAt = nowIso()
    return toPublicUser(file, user)
  })

const setUserDisabled = async (id: string, disabled: boolean) => updateUser(id, { disabled })
const resetPassword = async (id: string, password: string) => updateUser(id, { password })

const changeOwnPassword = async (id: string, currentPassword: string, newPassword: string) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === id)
    if (!user) {
      throw new Error('User not found.')
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new Error('Current password is incorrect.')
    }
    await assertPasswordMeetsPolicy(newPassword)

    user.passwordHash = await hashPassword(newPassword)
    user.passwordChangeRequired = false
    user.sessionVersion += 1
    user.updatedAt = nowIso()
  })

const completeRequiredPasswordChange = async (id: string, currentPassword: string, newPassword: string) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === id)
    if (!user) {
      throw new Error('User not found.')
    }
    if (!user.passwordChangeRequired) {
      throw new Error('Password change is not required for this account.')
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new Error('Current password is incorrect.')
    }
    await assertPasswordMeetsPolicy(newPassword)
    if (newPassword === currentPassword) {
      throw new Error('New password must be different from the current password.')
    }

    user.passwordHash = await hashPassword(newPassword)
    user.passwordChangeRequired = false
    user.updatedAt = nowIso()
    return toPublicUser(file, user)
  })

const deleteUser = async (id: string) =>
  mutateUsersFile(file => {
    const user = file.users.find(item => item.id === id)
    if (!user) {
      throw new Error('User not found.')
    }
    assertCanRemoveOrDisableUser(file, user)

    file.users = file.users.filter(item => item.id !== id)
    return toPublicUser(file, user)
  })

const updateGroup = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  }
) =>
  mutateUsersFile(file => {
    const group = file.groups.find(item => item.id === id)
    if (!group) {
      throw new Error('Group not found.')
    }

    if (input.name !== undefined) group.name = input.name.trim() || group.name
    if (input.description !== undefined) group.description = input.description.trim()
    if (input.role !== undefined) group.role = input.role
    if (input.permissions !== undefined)
      group.permissions = group.role === 'admin' ? fullPermissions : input.permissions
    if (input.quotas !== undefined) group.quotas = group.role === 'admin' ? unlimitedQuota : mergeQuotas(input.quotas)
    group.updatedAt = nowIso()
    return group
  })

const deleteGroup = async (id: string) =>
  mutateUsersFile(file => {
    const group = file.groups.find(item => item.id === id)
    if (!group) {
      throw new Error('Group not found.')
    }
    if (file.groups.length < 2) {
      throw new Error('Cannot remove the last user group.')
    }

    file.groups = file.groups.filter(item => item.id !== id)
    for (const user of file.users) {
      user.groupIds = user.groupIds.filter(groupId => groupId !== id)
      user.updatedAt = nowIso()
    }
    return group
  })

const createGroup = async (input: {
  name: string
  description?: string
  role?: UserRole
  permissions?: PermissionMap
  quotas?: Partial<ResourceQuota>
}) =>
  mutateUsersFile(file => {
    const name = input.name.trim()
    if (!name) {
      throw new Error('Group name is required.')
    }

    const role = input.role ?? 'user'
    const now = nowIso()
    const group: UserGroup = {
      id: randomUUID(),
      name,
      description: input.description?.trim() ?? '',
      role,
      permissions: role === 'admin' ? fullPermissions : (input.permissions ?? defaultUserPermissions),
      quotas: role === 'admin' ? unlimitedQuota : mergeQuotas(input.quotas),
      createdAt: now,
      updatedAt: now
    }
    file.groups.push(group)
    return group
  })

export const userService = {
  authenticate,
  changeOwnPassword,
  completeRequiredPasswordChange,
  createUser,
  createGroup,
  deleteGroup,
  deleteUser,
  getUserById,
  listGroups,
  listUsers,
  resetPassword,
  setUserDisabled,
  updateGroup,
  updateUser
}
