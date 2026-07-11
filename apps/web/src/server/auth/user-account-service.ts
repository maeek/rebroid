import { randomUUID } from 'node:crypto'
import 'server-only'
import { defaultAccentColor, isAccentColor } from '@/shared/model/theme/accent-color'
import { hashPassword } from './password-hashing'
import { assertPasswordMeetsPolicy, getPasswordMinimumLength } from './password-policy'
import { assertCanRemoveOrDisableUser } from './user-admin-guard'
import { findGroups, nowIso, toPublicUser, validateAvatarDataUrl } from './user-model'
import { mutateUsersFile } from './user-store'
import type { StoredUser, UserEditorInput } from './user-model'

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
    if (!user) throw new Error('User not found.')
    if (input.disabled && !user.disabled) assertCanRemoveOrDisableUser(file, user)

    if (input.username !== undefined) {
      const username = input.username.trim()
      if (!username) throw new Error('Username is required.')
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

const deleteUser = async (id: string) =>
  mutateUsersFile(file => {
    const user = file.users.find(item => item.id === id)
    if (!user) throw new Error('User not found.')
    assertCanRemoveOrDisableUser(file, user)
    file.users = file.users.filter(item => item.id !== id)
    return toPublicUser(file, user)
  })

export const userAccountService = {
  createUser,
  deleteUser,
  resetPassword: (id: string, password: string) => updateUser(id, { password }),
  setUserDisabled: (id: string, disabled: boolean) => updateUser(id, { disabled }),
  updateUser
}
