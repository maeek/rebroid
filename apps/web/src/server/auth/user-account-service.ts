import { randomUUID } from 'node:crypto'
import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { defaultAccentColor, isAccentColor } from '@/shared/model/theme/accent-color'
import { defaultUserGroupId } from '@/shared/permissions/effective-access'
import { hashPassword } from './password-hashing'
import { assertPasswordMeetsPolicy, getPasswordMinimumLength } from './password-policy'
import { assertCanChangeAdministrator } from './user-admin-guard'
import { nowIso, toPublicUser, validateAvatarDataUrl, validateGroupIds } from './user-model'
import { mutateAdministratorUsersFile, mutateUsersFile, type AdministratorMutation } from './user-store'
import type { StoredUser, UsersFile } from './user-model'
import type { UserEditorInput } from '@/shared/contracts/auth-user'

const createUser = async (
  {
    username,
    password,
    groupIds = [defaultUserGroupId],
    ...input
  }: UserEditorInput & { username: string; password: string },
  administrator: AdministratorMutation
) => {
  const { value } = await mutateAdministratorUsersFile(administrator, async file => {
    const passwordMinimumLength = await getPasswordMinimumLength()
    const normalizedUsername = username.trim()
    if (!normalizedUsername) {
      throw new PublicActionError(
        `Username is required and password must be at least ${passwordMinimumLength} characters.`,
        { code: 'validation', status: 422 }
      )
    }
    await assertPasswordMeetsPolicy(password)
    validateAvatarDataUrl(input.avatarDataUrl)
    if (input.accentColor !== undefined && !isAccentColor(input.accentColor)) {
      throw new PublicActionError('Unsupported accent color.', { code: 'validation', status: 422 })
    }
    if (
      file.users.some(
        user => user.username.toLocaleLowerCase('en-US') === normalizedUsername.toLocaleLowerCase('en-US')
      )
    ) {
      throw new PublicActionError('Username already exists.', { code: 'conflict', status: 409 })
    }

    const memberships = validateGroupIds(file.groups, groupIds)
    const now = nowIso()
    const user: StoredUser = {
      id: randomUUID(),
      username: normalizedUsername,
      name: input.name?.trim() || normalizedUsername,
      groupIds: memberships,
      disabled: input.disabled ?? false,
      passwordChangeRequired: true,
      sessionVersion: 1,
      avatarDataUrl: input.avatarDataUrl ?? null,
      accentColor: input.accentColor ?? defaultAccentColor,
      passwordHash: await hashPassword(password),
      mfaSecretEncrypted: null,
      mfaRecoveryCodeHashes: [],
      createdAt: now,
      updatedAt: now
    }
    file.users.push(user)
    return { value: toPublicUser(file, user) }
  })
  return value
}

const applyUserUpdate = async (file: UsersFile, id: string, input: UserEditorInput) => {
  const user = file.users.find(item => item.id === id)
  if (!user) throw new PublicActionError('User not found.', { code: 'not_found', status: 404 })
  const groupIds = input.groupIds === undefined ? user.groupIds : validateGroupIds(file.groups, input.groupIds)
  assertCanChangeAdministrator(file, user, { groupIds, disabled: input.disabled ?? user.disabled })

  if (input.username !== undefined) {
    const username = input.username.trim()
    if (!username) throw new PublicActionError('Username is required.', { code: 'validation', status: 422 })
    if (
      file.users.some(
        item => item.id !== id && item.username.toLocaleLowerCase('en-US') === username.toLocaleLowerCase('en-US')
      )
    ) {
      throw new PublicActionError('Username already exists.', { code: 'conflict', status: 409 })
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
  user.groupIds = groupIds
  if (input.disabled !== undefined && input.disabled !== user.disabled) {
    user.disabled = input.disabled
    user.sessionVersion += 1
  }
  if (input.avatarDataUrl !== undefined) {
    validateAvatarDataUrl(input.avatarDataUrl)
    user.avatarDataUrl = input.avatarDataUrl
  }
  if (input.accentColor !== undefined && !isAccentColor(input.accentColor)) {
    throw new PublicActionError('Unsupported accent color.', { code: 'validation', status: 422 })
  }
  if (input.accentColor !== undefined) user.accentColor = input.accentColor

  user.updatedAt = nowIso()
  return toPublicUser(file, user)
}

const updateUser = (id: string, input: UserEditorInput, administrator: AdministratorMutation) =>
  mutateAdministratorUsersFile(administrator, async file => ({
    value: await applyUserUpdate(file, id, input),
    affectedOwners: [id]
  }))

const deleteUser = (id: string, administrator: AdministratorMutation) =>
  mutateAdministratorUsersFile(administrator, file => {
    const user = file.users.find(item => item.id === id)
    if (!user) throw new PublicActionError('User not found.', { code: 'not_found', status: 404 })
    assertCanChangeAdministrator(file, user, { groupIds: [], disabled: true })
    file.users = file.users.filter(item => item.id !== id)
    return { value: toPublicUser(file, user), affectedOwners: [id] }
  })

export const userAccountService = {
  createUser,
  deleteUser,
  setUserDisabled: (id: string, disabled: boolean, administrator: AdministratorMutation) =>
    updateUser(id, { disabled }, administrator),
  updateUser,
  updateOwnProfile: (
    id: string,
    { avatarDataUrl, accentColor }: Pick<UserEditorInput, 'avatarDataUrl' | 'accentColor'>
  ) => mutateUsersFile(file => applyUserUpdate(file, id, { avatarDataUrl, accentColor }))
}
