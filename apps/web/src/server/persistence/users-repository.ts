import 'server-only'
import { z } from 'zod'
import { getDatabase } from './database'
import type { StoredUser, UsersFile } from '@/server/auth/user-model'
import type { UserGroup, UserRole } from '@/shared/contracts/auth-user'
import type { PermissionMap, ResourceQuota } from '@/shared/permissions/permissions'

const permissionMapSchema = z.record(z.string(), z.boolean())
const quotaSchema = z.object({
  maxOpenApps: z.number().nonnegative().nullable().optional(),
  maxSessionSeconds: z.number().nonnegative().nullable().optional(),
  maxMemoryMb: z.number().nonnegative().nullable().optional(),
  maxCpuCpus: z.number().nonnegative().nullable().optional()
})

const parsePermissions = (value: string) => permissionMapSchema.parse(JSON.parse(value)) as PermissionMap
const parseQuotas = (value: string) => quotaSchema.parse(JSON.parse(value)) as Partial<ResourceQuota>

interface GroupRow {
  id: string
  name: string
  description: string
  role: UserRole
  permissions_json: string
  quotas_json: string
  created_at: string
  updated_at: string
}

interface UserRow {
  id: string
  username: string
  name: string
  role: UserRole
  disabled: number
  password_change_required: number
  session_version: number
  avatar_data_url: string | null
  accent_color: StoredUser['accentColor']
  permission_overrides_json: string
  quotas_json: string
  password_hash: string
  mfa_secret_encrypted: string | null
  mfa_recovery_codes_json: string
  created_at: string
  updated_at: string
}

const readGroups = (): UserGroup[] =>
  (getDatabase().prepare('SELECT * FROM groups ORDER BY id').all() as GroupRow[]).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    role: row.role,
    permissions: parsePermissions(row.permissions_json),
    quotas: parseQuotas(row.quotas_json) as ResourceQuota,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

export const readUsersFileFromDatabase = (): UsersFile | null => {
  const client = getDatabase()
  const rows = client.prepare('SELECT * FROM users ORDER BY id').all() as UserRow[]
  const groups = readGroups()
  if (rows.length === 0 && groups.length === 0) return null

  const memberships = client.prepare('SELECT user_id, group_id FROM group_memberships').all() as Array<{
    user_id: string
    group_id: string
  }>
  const groupIdsByUser = new Map<string, string[]>()
  for (const membership of memberships) {
    const groupIds = groupIdsByUser.get(membership.user_id) ?? []
    groupIds.push(membership.group_id)
    groupIdsByUser.set(membership.user_id, groupIds)
  }

  const users: StoredUser[] = rows.map(row => ({
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    groupIds: groupIdsByUser.get(row.id) ?? [],
    disabled: row.disabled === 1,
    passwordChangeRequired: row.password_change_required === 1,
    sessionVersion: row.session_version,
    avatarDataUrl: row.avatar_data_url,
    accentColor: row.accent_color,
    permissionOverrides: parsePermissions(row.permission_overrides_json),
    quotas: parseQuotas(row.quotas_json),
    passwordHash: row.password_hash,
    mfaSecretEncrypted: row.mfa_secret_encrypted,
    mfaRecoveryCodeHashes: z.array(z.string()).parse(JSON.parse(row.mfa_recovery_codes_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return { users, groups }
}

export const replaceUsersFile = (file: UsersFile) => {
  const client = getDatabase()
  client.transaction(() => {
    client.prepare('DELETE FROM group_memberships').run()
    client.prepare('DELETE FROM users').run()
    client.prepare('DELETE FROM groups').run()

    const insertGroup = client.prepare(
      'INSERT INTO groups (id, name, description, role, permissions_json, quotas_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const insertUser = client.prepare(
      'INSERT INTO users (id, username, name, role, disabled, password_change_required, session_version, avatar_data_url, accent_color, permission_overrides_json, quotas_json, password_hash, mfa_secret_encrypted, mfa_recovery_codes_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const insertMembership = client.prepare('INSERT INTO group_memberships (user_id, group_id) VALUES (?, ?)')

    for (const group of file.groups) {
      insertGroup.run(
        group.id,
        group.name,
        group.description,
        group.role,
        JSON.stringify(group.permissions),
        JSON.stringify(group.quotas),
        group.createdAt,
        group.updatedAt
      )
    }
    for (const user of file.users) {
      insertUser.run(
        user.id,
        user.username,
        user.name,
        user.role,
        user.disabled ? 1 : 0,
        user.passwordChangeRequired ? 1 : 0,
        user.sessionVersion,
        user.avatarDataUrl,
        user.accentColor,
        JSON.stringify(user.permissionOverrides),
        JSON.stringify(user.quotas),
        user.passwordHash,
        user.mfaSecretEncrypted,
        JSON.stringify(user.mfaRecoveryCodeHashes),
        user.createdAt,
        user.updatedAt
      )
      for (const groupId of user.groupIds) insertMembership.run(user.id, groupId)
    }
  })()
}
