import { isDeepStrictEqual } from 'node:util'
import 'server-only'
import { z } from 'zod'
import { groupPermissionsSchema, groupQuotaSchema, type StoredUser, type UsersFile } from '@/server/auth/user-model'
import { mergeQuotas } from '@/shared/permissions/permissions'
import { getDatabase } from './database'
import { enqueueWebMaintenance, type ViewerRevocationJob } from './web-maintenance-repository'
import type { UserGroup } from '@/shared/contracts/auth-user'

interface GroupRow {
  id: string
  name: string
  description: string
  permissions_json: string
  quotas_json: string
  created_at: string
  updated_at: string
}

interface UserRow {
  id: string
  username: string
  name: string
  disabled: number
  password_change_required: number
  session_version: number
  avatar_data_url: string | null
  accent_color: StoredUser['accentColor']
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
    permissions: groupPermissionsSchema.parse(JSON.parse(row.permissions_json)),
    quotas: mergeQuotas(groupQuotaSchema.parse(JSON.parse(row.quotas_json))),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

export const readUsersFileFromDatabase = (): UsersFile | null => {
  const client = getDatabase()
  const rows = client.prepare('SELECT * FROM users ORDER BY id').all() as UserRow[]
  const groups = readGroups()
  if (rows.length === 0 && groups.length === 0) return null

  const memberships = client
    .prepare('SELECT user_id, group_id FROM group_memberships ORDER BY user_id, position')
    .all() as Array<{
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
    groupIds: groupIdsByUser.get(row.id) ?? [],
    disabled: row.disabled === 1,
    passwordChangeRequired: row.password_change_required === 1,
    sessionVersion: row.session_version,
    avatarDataUrl: row.avatar_data_url,
    accentColor: row.accent_color,
    passwordHash: row.password_hash,
    mfaSecretEncrypted: row.mfa_secret_encrypted,
    mfaRecoveryCodeHashes: z.array(z.string()).parse(JSON.parse(row.mfa_recovery_codes_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return { users, groups }
}

export const writeUsersFileToDatabase = (file: UsersFile, revocation?: ViewerRevocationJob) => {
  const client = getDatabase()
  client.transaction(() => {
    const previous = readUsersFileFromDatabase()
    const groups = new Map(file.groups.map(group => [group.id, group]))
    const users = new Map(file.users.map(user => [user.id, user]))
    const previousGroups = new Map(previous?.groups.map(group => [group.id, group]))
    const previousUsers = new Map(previous?.users.map(user => [user.id, user]))
    const deleteUser = client.prepare('DELETE FROM users WHERE id = ?')
    const deleteGroup = client.prepare('DELETE FROM groups WHERE id = ?')
    for (const id of previousUsers.keys()) if (!users.has(id)) deleteUser.run(id)
    for (const id of previousGroups.keys()) if (!groups.has(id)) deleteGroup.run(id)

    const insertGroup = client.prepare(
      'INSERT INTO groups (id, name, description, permissions_json, quotas_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, permissions_json = excluded.permissions_json, quotas_json = excluded.quotas_json, created_at = excluded.created_at, updated_at = excluded.updated_at'
    )
    const insertUser = client.prepare(
      'INSERT INTO users (id, username, name, disabled, password_change_required, session_version, avatar_data_url, accent_color, password_hash, mfa_secret_encrypted, mfa_recovery_codes_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username, name = excluded.name, disabled = excluded.disabled, password_change_required = excluded.password_change_required, session_version = excluded.session_version, avatar_data_url = excluded.avatar_data_url, accent_color = excluded.accent_color, password_hash = excluded.password_hash, mfa_secret_encrypted = excluded.mfa_secret_encrypted, mfa_recovery_codes_json = excluded.mfa_recovery_codes_json, created_at = excluded.created_at, updated_at = excluded.updated_at'
    )
    const insertMembership = client.prepare(
      'INSERT INTO group_memberships (user_id, group_id, position) VALUES (?, ?, ?)'
    )
    const deleteMembership = client.prepare('DELETE FROM group_memberships WHERE user_id = ?')

    for (const group of groups.values()) {
      if (isDeepStrictEqual(previousGroups.get(group.id), group)) continue
      insertGroup.run(
        group.id,
        group.name,
        group.description,
        JSON.stringify(group.permissions),
        JSON.stringify(group.quotas),
        group.createdAt,
        group.updatedAt
      )
    }
    for (const user of users.values()) {
      const { groupIds, ...account } = user
      const { groupIds: oldGroupIds, ...oldAccount } = previousUsers.get(user.id) ?? {}
      if (!isDeepStrictEqual(oldAccount, account))
        insertUser.run(
          user.id,
          user.username,
          user.name,
          user.disabled ? 1 : 0,
          user.passwordChangeRequired ? 1 : 0,
          user.sessionVersion,
          user.avatarDataUrl,
          user.accentColor,
          user.passwordHash,
          user.mfaSecretEncrypted,
          JSON.stringify(user.mfaRecoveryCodeHashes),
          user.createdAt,
          user.updatedAt
        )
      if (!isDeepStrictEqual(oldGroupIds, groupIds)) {
        deleteMembership.run(user.id)
        groupIds.forEach((groupId, position) => insertMembership.run(user.id, groupId, position))
      }
    }
    if (revocation) enqueueWebMaintenance(revocation)
  })()
}
