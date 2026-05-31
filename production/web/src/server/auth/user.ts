import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import bcrypt from 'bcrypt'
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

type StoredUser = Omit<PublicUser, 'effectivePermissions' | 'effectiveQuotas'> & {
  passwordHash: string
}

type UsersFile = {
  users: StoredUser[]
  groups: UserGroup[]
}

const bcryptRounds = 12
const minimumPasswordLength = 12
const maxAvatarBytes = 2 * 1024 * 1024
const usersPath = () => process.env.WEB_USERS_PATH || join(process.cwd(), 'data', 'users.json')

const nowIso = () => new Date().toISOString()

const validateAvatarDataUrl = (avatarDataUrl: string | null | undefined) => {
  if (!avatarDataUrl) {
    return
  }
  const match = avatarDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/)
  if (!match || Buffer.from(match[2], 'base64').length > maxAvatarBytes) {
    throw new Error('Avatar must be a PNG, JPEG, or WebP image no larger than 2 MB.')
  }
}

const defaultGroups = (): UserGroup[] => {
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

const findGroups = (file: UsersFile, groupIds: string[] | undefined, role: UserRole) => {
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

const toPublicUser = (file: UsersFile, user: StoredUser): PublicUser => {
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

const hashPassword = async (password: string) => bcrypt.hash(password, bcryptRounds)

const verifyPassword = async (password: string, passwordHash: string) => {
  if (!passwordHash.startsWith('$2')) {
    return false
  }

  return bcrypt.compare(password, passwordHash)
}

const defaultAdminUser = async (): Promise<StoredUser> => {
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
    passwordHash: await hashPassword(process.env.INITIAL_ADMIN_PASSWORD || 'admin'),
    createdAt: now,
    updatedAt: now
  }
}

const normalizeUser = (
  user: Partial<StoredUser> & Pick<StoredUser, 'id' | 'username' | 'passwordHash'>
): StoredUser => {
  const now = nowIso()
  const role = user.role ?? 'user'
  const legacyGroupId = (user as Partial<StoredUser> & { groupId?: string }).groupId
  const groupIds = user.groupIds ?? (legacyGroupId ? [legacyGroupId] : [role === 'admin' ? 'admins' : 'users'])

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

const normalizeUsersFile = async (input: Partial<UsersFile>): Promise<UsersFile> => {
  const groups = input.groups && input.groups.length > 0 ? input.groups : defaultGroups()
  const normalizedGroups = groups.map(group => ({
    ...group,
    description: group.description ?? '',
    permissions: group.role === 'admin' ? fullPermissions : (group.permissions ?? {}),
    quotas: group.role === 'admin' ? unlimitedQuota : mergeQuotas(group.quotas),
    createdAt: group.createdAt ?? nowIso(),
    updatedAt: group.updatedAt ?? nowIso()
  }))
  const users =
    input.users && input.users.length > 0 ? input.users.map(user => normalizeUser(user)) : [await defaultAdminUser()]

  return { groups: normalizedGroups, users }
}

const readUsersFile = async (): Promise<UsersFile> => {
  try {
    return normalizeUsersFile(JSON.parse(await readFile(usersPath(), 'utf-8')) as Partial<UsersFile>)
  } catch {
    const initial = await normalizeUsersFile({})
    await writeUsersFile(initial)
    return initial
  }
}

const writeUsersFile = async (file: UsersFile) => {
  const path = usersPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
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
}: UserEditorInput & { username: string; password: string }) => {
  const file = await readUsersFile()
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
  await writeUsersFile(file)
  return toPublicUser(file, user)
}

const updateUser = async (id: string, input: UserEditorInput) => {
  const file = await readUsersFile()
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
  await writeUsersFile(file)
  return toPublicUser(file, user)
}

const setUserDisabled = async (id: string, disabled: boolean) => updateUser(id, { disabled })
const resetPassword = async (id: string, password: string) => updateUser(id, { password })

const deleteUser = async (id: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.id === id)
  if (!user) {
    throw new Error('User not found.')
  }
  assertCanRemoveOrDisableUser(file, user)

  file.users = file.users.filter(item => item.id !== id)
  await writeUsersFile(file)
  return toPublicUser(file, user)
}

const updateGroup = async (
  id: string,
  input: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'updatedAt' | 'quotas'>> & {
    quotas?: Partial<ResourceQuota>
  }
) => {
  const file = await readUsersFile()
  const group = file.groups.find(item => item.id === id)
  if (!group) {
    throw new Error('Group not found.')
  }

  if (input.name !== undefined) group.name = input.name.trim() || group.name
  if (input.description !== undefined) group.description = input.description.trim()
  if (input.role !== undefined) group.role = input.role
  if (input.permissions !== undefined) group.permissions = group.role === 'admin' ? fullPermissions : input.permissions
  if (input.quotas !== undefined) group.quotas = group.role === 'admin' ? unlimitedQuota : mergeQuotas(input.quotas)
  group.updatedAt = nowIso()
  await writeUsersFile(file)
  return group
}

const createGroup = async (input: {
  name: string
  description?: string
  role?: UserRole
  permissions?: PermissionMap
  quotas?: Partial<ResourceQuota>
}) => {
  const file = await readUsersFile()
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
  await writeUsersFile(file)
  return group
}

export const userService = {
  authenticate,
  createUser,
  createGroup,
  deleteUser,
  getUserById,
  listGroups,
  listUsers,
  resetPassword,
  setUserDisabled,
  updateGroup,
  updateUser
}
