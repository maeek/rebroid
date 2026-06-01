import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { initialWebSchema } from './migrations/0000-initial'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  data: text('data').notNull()
})

export const userGroups = sqliteTable('user_groups', {
  id: text('id').primaryKey(),
  data: text('data').notNull()
})

export const userGroupMemberships = sqliteTable('user_group_memberships', {
  userId: text('user_id').notNull(),
  groupId: text('group_id').notNull()
})

export const recentApps = sqliteTable('recent_apps', {
  userId: text('user_id').notNull(),
  appId: text('app_id').notNull(),
  openedAt: integer('opened_at').notNull()
})

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  subject: text('subject'),
  detailsJson: text('details_json').notNull(),
  createdAt: text('created_at').notNull()
})

type WebDatabase = {
  client: Database.Database
  orm: BetterSQLite3Database
}

type UsersFile = {
  users: Array<{ id: string; groupIds?: string[] } & Record<string, unknown>>
  groups: Array<{ id: string } & Record<string, unknown>>
}

type RecentAppsFile = {
  users: Record<string, Array<{ id: string; openedAt: number }>>
}

let instance: WebDatabase | undefined
let instancePath: string | undefined

const databasePath = () =>
  process.env.WEB_DATABASE_PATH || join(/* turbopackIgnore: true */ process.cwd(), 'data', 'web.sqlite')
const resetInstruction =
  'Reset stored state with "docker compose -f deploy/compose.yaml down -v" before starting Rebroid.'

const tableExists = (client: Database.Database, name: string) =>
  Boolean(client.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name))

const openDatabase = (): WebDatabase => {
  const path = databasePath()
  if (instance && instancePath === path) return instance

  instance?.client.close()
  mkdirSync(dirname(path), { recursive: true })
  const client = new Database(path)
  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')
  const schemaVersion = client.pragma('user_version', { simple: true }) as number

  if (schemaVersion === 0 && !tableExists(client, 'web_state')) {
    client.exec(initialWebSchema)
  } else if (schemaVersion !== 2) {
    client.close()
    throw new Error(`Unsupported web database schema version ${schemaVersion}. ${resetInstruction}`)
  }

  instance = { client, orm: drizzle(client) }
  instancePath = path
  return instance
}

const readUsers = (client: Database.Database) => {
  const storedUsers = client.prepare('SELECT data FROM users ORDER BY id').all() as Array<{ data: string }>
  const storedGroups = client.prepare('SELECT data FROM user_groups ORDER BY id').all() as Array<{ data: string }>
  if (storedUsers.length === 0 && storedGroups.length === 0) return null

  return JSON.stringify({
    users: storedUsers.map(({ data }) => JSON.parse(data) as unknown),
    groups: storedGroups.map(({ data }) => JSON.parse(data) as unknown)
  })
}

const writeUsers = (client: Database.Database, value: string) => {
  const file = JSON.parse(value) as Partial<UsersFile>
  if (!Array.isArray(file.users) || !Array.isArray(file.groups)) throw new Error('The users store is malformed.')

  client.prepare('DELETE FROM user_group_memberships').run()
  client.prepare('DELETE FROM users').run()
  client.prepare('DELETE FROM user_groups').run()
  const insertUser = client.prepare('INSERT INTO users (id, data) VALUES (?, ?)')
  const insertGroup = client.prepare('INSERT INTO user_groups (id, data) VALUES (?, ?)')
  const insertMembership = client.prepare('INSERT INTO user_group_memberships (user_id, group_id) VALUES (?, ?)')

  for (const group of file.groups) insertGroup.run(group.id, JSON.stringify(group))
  for (const user of file.users) {
    insertUser.run(user.id, JSON.stringify(user))
    for (const groupId of user.groupIds ?? []) insertMembership.run(user.id, groupId)
  }
}

const readSettings = (client: Database.Database) =>
  (client.prepare("SELECT value FROM settings WHERE key = 'web-settings'").get() as { value: string } | undefined)
    ?.value ?? null

const writeSettings = (client: Database.Database, value: string) => {
  JSON.parse(value)
  client
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('web-settings', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .run(value, new Date().toISOString())
}

const readRecentApps = (client: Database.Database) => {
  const rows = client
    .prepare('SELECT user_id, app_id, opened_at FROM recent_apps ORDER BY opened_at DESC')
    .all() as Array<{
    user_id: string
    app_id: string
    opened_at: number
  }>
  if (rows.length === 0) return null
  const file: RecentAppsFile = { users: {} }
  for (const row of rows) {
    ;(file.users[row.user_id] ??= []).push({ id: row.app_id, openedAt: row.opened_at })
  }
  return JSON.stringify(file)
}

const writeRecentApps = (client: Database.Database, value: string) => {
  const file = JSON.parse(value) as Partial<RecentAppsFile>
  if (!file.users || typeof file.users !== 'object') throw new Error('The recent applications store is malformed.')
  client.prepare('DELETE FROM recent_apps').run()
  const insert = client.prepare('INSERT INTO recent_apps (user_id, app_id, opened_at) VALUES (?, ?, ?)')
  for (const [userId, apps] of Object.entries(file.users)) {
    for (const app of apps) insert.run(userId, app.id, app.openedAt)
  }
}

export const readWebState = (key: string) => {
  const { client } = openDatabase()
  if (key === 'users') return readUsers(client)
  if (key === 'web-settings') return readSettings(client)
  if (key === 'recent-apps') return readRecentApps(client)
  throw new Error(`Unknown web state key: ${key}`)
}

export const writeWebState = (key: string, value: string) => {
  const { client } = openDatabase()
  client.transaction(() => {
    if (key === 'users') return writeUsers(client, value)
    if (key === 'web-settings') return writeSettings(client, value)
    if (key === 'recent-apps') return writeRecentApps(client, value)
    throw new Error(`Unknown web state key: ${key}`)
  })()
}

export const updateWebState = <Result>(key: string, update: (current: string | null) => [string, Result]) => {
  const { client } = openDatabase()
  return client.transaction(() => {
    const [value, result] = update(readWebState(key))
    writeWebState(key, value)
    return result
  })()
}

export const appendAuditEvent = (
  action: string,
  options: { actorUserId?: string | null; subject?: string | null; details?: Record<string, unknown> } = {}
) => {
  openDatabase()
    .client.prepare(
      'INSERT INTO audit_events (actor_user_id, action, subject, details_json, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      options.actorUserId ?? null,
      action,
      options.subject ?? null,
      JSON.stringify(options.details ?? {}),
      new Date().toISOString()
    )
}

export type AuditEvent = {
  id: number
  actorUserId: string | null
  action: string
  subject: string | null
  details: Record<string, unknown>
  createdAt: string
}

export const listAuditEvents = (limit = 500): AuditEvent[] => {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000)
  const rows = openDatabase()
    .client.prepare(
      'SELECT id, actor_user_id, action, subject, details_json, created_at FROM audit_events ORDER BY id DESC LIMIT ?'
    )
    .all(boundedLimit) as Array<{
    id: number
    actor_user_id: string | null
    action: string
    subject: string | null
    details_json: string
    created_at: string
  }>

  return rows.map(row => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    subject: row.subject,
    details: JSON.parse(row.details_json) as Record<string, unknown>,
    createdAt: row.created_at
  }))
}

export const corruptWebStateForTests = (key: 'users' | 'web-settings', value: string) => {
  const { client } = openDatabase()
  if (key === 'users') {
    client.prepare('DELETE FROM users').run()
    client.prepare('INSERT INTO users (id, data) VALUES (?, ?)').run('corrupt', value)
    return
  }
  client
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('web-settings', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(value, new Date().toISOString())
}

export const resetWebDatabaseForTests = () => {
  instance?.client.close()
  instance = undefined
  instancePath = undefined
}
