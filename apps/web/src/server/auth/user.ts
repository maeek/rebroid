import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { readWebState, writeWebState } from '@/server/storage/database'
import {
  defaultUserPermissions,
  fullPermissions,
  mergeQuotas,
  unlimitedQuota,
  type PermissionMap,
  type ResourceQuota
} from '@/shared/permissions/permissions'
import {
  findGroups,
  minimumPasswordLength,
  normalizeGroups,
  normalizeUser,
  nowIso,
  toPublicUser,
  validateAvatarDataUrl
} from './user-model'
import type { StoredUser, UserEditorInput, UserGroup, UserRole, UsersFile } from './user-model'

export type { PublicUser, UserEditorInput, UserGroup, UserRole } from './user-model'

const bcryptRounds = 12
const usersStateKey = 'users'
let usersMutationQueue = Promise.resolve()

const hashPassword = async (password: string) => bcrypt.hash(password, bcryptRounds)

const verifyPassword = async (password: string, passwordHash: string) => {
  if (!passwordHash.startsWith('$2')) {
    return false
  }

  return bcrypt.compare(password, passwordHash)
}

const defaultAdminUser = async (): Promise<StoredUser> => {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD
  if (!initialPassword) {
    throw new Error('INITIAL_ADMIN_PASSWORD is required when creating the first administrator.')
  }

  const now = nowIso()
  return {
    id: 'admin',
    username: 'admin',
    name: 'Admin',
    role: 'admin',
    groupIds: ['admins'],
    disabled: false,
    sessionVersion: 1,
    avatarDataUrl: null,
    permissionOverrides: {},
    quotas: {},
    passwordHash: await hashPassword(initialPassword),
    createdAt: now,
    updatedAt: now
  }
}

const normalizeUsersFile = async (input: Partial<UsersFile>): Promise<UsersFile> => {
  const normalizedGroups = normalizeGroups(input.groups)
  const users =
    input.users && input.users.length > 0 ? input.users.map(user => normalizeUser(user)) : [await defaultAdminUser()]

  return { groups: normalizedGroups, users }
}

const readUsersFile = async (): Promise<UsersFile> => {
  const stored = readWebState(usersStateKey)
  if (stored !== null) {
    return normalizeUsersFile(parseUsersFile(stored))
  }

  const initial = await normalizeUsersFile({})
  await writeUsersFile(initial)
  return initial
}

const writeUsersFile = (file: UsersFile) => {
  return Promise.resolve(writeWebState(usersStateKey, JSON.stringify(file)))
}

const parseUsersFile = (content: string): Partial<UsersFile> => {
  const parsed = JSON.parse(content) as Partial<UsersFile>
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users) || !Array.isArray(parsed.groups)) {
    throw new Error(
      'The users store is malformed. Restore it from backup or repair it before starting the web service.'
    )
  }

  return parsed
}

const mutateUsersFile = async <Result>(mutation: (file: UsersFile) => Promise<Result> | Result) => {
  const pending = usersMutationQueue.then(async () => {
    const file = await readUsersFile()
    const result = await mutation(file)
    await writeUsersFile(file)
    return result
  })
  usersMutationQueue = pending.then(
    () => undefined,
    () => undefined
  )
  return pending
}

const listUsers = async () => {
  const file = await readUsersFile()
  return file.users.map(user => toPublicUser(file, user))
}

const listGroups = async () => {
  const file = await readUsersFile()
  return file.groups
}

const getUserById = async (id: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.id === id)
  return user ? toPublicUser(file, user) : null
}

const authenticate = async (username: string, password: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.username === username)
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    return null
  }

  return {
    id: user.id,
    name: user.name,
    email: null,
    image: user.avatarDataUrl,
    role: user.role,
    sessionVersion: user.sessionVersion
  }
}

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
    const normalizedUsername = username.trim()
    if (!normalizedUsername || password.length < minimumPasswordLength) {
      throw new Error(`Username is required and password must be at least ${minimumPasswordLength} characters.`)
    }
    validateAvatarDataUrl(input.avatarDataUrl)
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
      sessionVersion: 1,
      avatarDataUrl: input.avatarDataUrl ?? null,
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
      if (input.password.length < minimumPasswordLength) {
        throw new Error(`Password must be at least ${minimumPasswordLength} characters.`)
      }
      user.passwordHash = await hashPassword(input.password)
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
    if (newPassword.length < minimumPasswordLength) {
      throw new Error(`Password must be at least ${minimumPasswordLength} characters.`)
    }

    user.passwordHash = await hashPassword(newPassword)
    user.sessionVersion += 1
    user.updatedAt = nowIso()
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
