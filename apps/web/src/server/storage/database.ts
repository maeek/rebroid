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
  createdAt: text('created_at').notNull(),
  actorUserId: text('actor_user_id'),
  actorLabel: text('actor_label').notNull(),
  action: text('action').notNull(),
  category: text('category').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  resourceLabel: text('resource_label'),
  outcome: text('outcome').notNull(),
  detailsJson: text('details_json').notNull(),
  sourceIp: text('source_ip'),
  userAgent: text('user_agent')
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
let lastAuditRetentionAt = 0

const databasePath = () =>
  process.env.WEB_DATABASE_PATH || join(/* turbopackIgnore: true */ process.cwd(), 'data', 'web.sqlite')
const resetInstruction =
  'Reset stored state with "docker compose -f deploy/compose.yaml down -v" before starting Rebroid.'

const tableExists = (client: Database.Database, name: string) =>
  Boolean(client.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name))

const auditColumns = [
  'id',
  'created_at',
  'actor_user_id',
  'actor_label',
  'action',
  'category',
  'resource_type',
  'resource_id',
  'resource_label',
  'outcome',
  'details_json',
  'source_ip',
  'user_agent'
]

const createAuditEventsTable = (client: Database.Database) => {
  client.exec(`
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      actor_user_id TEXT,
      actor_label TEXT NOT NULL,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      resource_label TEXT,
      outcome TEXT NOT NULL,
      details_json TEXT NOT NULL,
      source_ip TEXT,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS audit_events_created_at ON audit_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_events_category_created_at ON audit_events(category, created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_events_actor_created_at ON audit_events(actor_user_id, created_at DESC);
  `)
}

const ensureAuditEventsSchema = (client: Database.Database) => {
  if (!tableExists(client, 'audit_events')) {
    createAuditEventsTable(client)
    return
  }

  const columns = client.prepare('PRAGMA table_info(audit_events)').all() as Array<{ name: string }>
  const current = columns.map(column => column.name)
  if (auditColumns.every(column => current.includes(column))) {
    client.exec(`
      CREATE INDEX IF NOT EXISTS audit_events_created_at ON audit_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS audit_events_category_created_at ON audit_events(category, created_at DESC);
      CREATE INDEX IF NOT EXISTS audit_events_actor_created_at ON audit_events(actor_user_id, created_at DESC);
    `)
    return
  }

  client.exec(`
    DROP TABLE audit_events;
    DROP INDEX IF EXISTS audit_events_created_at;
    DROP INDEX IF EXISTS audit_events_category_created_at;
    DROP INDEX IF EXISTS audit_events_actor_created_at;
  `)
  createAuditEventsTable(client)
}

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
  ensureAuditEventsSchema(client)

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

export type AuditEventOutcome = 'success' | 'failure'

export type AuditEventInput = {
  actorUserId?: string | null
  actorLabel?: string | null
  action: string
  category: string
  resourceType?: string | null
  resourceId?: string | null
  resourceLabel?: string | null
  outcome?: AuditEventOutcome
  details?: Record<string, unknown>
  sourceIp?: string | null
  userAgent?: string | null
}

export type AuditEvent = {
  id: number
  actorUserId: string | null
  actorLabel: string
  action: string
  category: string
  resourceType: string | null
  resourceId: string | null
  resourceLabel: string | null
  outcome: AuditEventOutcome
  details: Record<string, unknown>
  sourceIp: string | null
  userAgent: string | null
  createdAt: string
}

export type AuditEventFilters = {
  search?: string
  actorUserId?: string
  category?: string
  action?: string
  resourceType?: string
  resourceId?: string
  outcome?: AuditEventOutcome
  from?: string
  to?: string
}

export type AuditEventPage = {
  events: AuditEvent[]
  total: number
  page: number
  pageSize: number
  summary: {
    success: number
    failure: number
    lastEventAt: string | null
  }
}

const normalizeAuditDetails = (details: Record<string, unknown> | undefined) =>
  JSON.stringify(details ?? {}, (_key, value: unknown) => {
    if (typeof value === 'bigint') return value.toString()
    return value
  })

export const appendAuditEvent = (input: AuditEventInput) => {
  openDatabase()
    .client.prepare(
      'INSERT INTO audit_events (created_at, actor_user_id, actor_label, action, category, resource_type, resource_id, resource_label, outcome, details_json, source_ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      new Date().toISOString(),
      input.actorUserId ?? null,
      input.actorLabel?.trim() || input.actorUserId || 'system',
      input.action,
      input.category,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.resourceLabel ?? null,
      input.outcome ?? 'success',
      normalizeAuditDetails(input.details),
      input.sourceIp ?? null,
      input.userAgent ?? null
    )
}

const parseAuditRow = (row: {
  id: number
  actor_user_id: string | null
  actor_label: string
  action: string
  category: string
  resource_type: string | null
  resource_id: string | null
  resource_label: string | null
  outcome: AuditEventOutcome
  details_json: string
  source_ip: string | null
  user_agent: string | null
  created_at: string
}): AuditEvent => ({
  id: row.id,
  actorUserId: row.actor_user_id,
  actorLabel: row.actor_label,
  action: row.action,
  category: row.category,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  resourceLabel: row.resource_label,
  outcome: row.outcome,
  details: JSON.parse(row.details_json) as Record<string, unknown>,
  sourceIp: row.source_ip,
  userAgent: row.user_agent,
  createdAt: row.created_at
})

const auditSelectColumns = [
  'id',
  'actor_user_id',
  'actor_label',
  'action',
  'category',
  'resource_type',
  'resource_id',
  'resource_label',
  'outcome',
  'details_json',
  'source_ip',
  'user_agent',
  'created_at'
].join(', ')

const auditWhere = (filters: AuditEventFilters = {}) => {
  const clauses: string[] = []
  const values: Array<string> = []
  const search = filters.search?.trim()
  if (search) {
    const pattern = `%${search.toLowerCase()}%`
    clauses.push(
      "(lower(action) LIKE ? OR lower(category) LIKE ? OR lower(actor_label) LIKE ? OR lower(coalesce(resource_type, '')) LIKE ? OR lower(coalesce(resource_id, '')) LIKE ? OR lower(coalesce(resource_label, '')) LIKE ? OR lower(details_json) LIKE ?)"
    )
    values.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern)
  }
  if (filters.actorUserId) {
    clauses.push('actor_user_id = ?')
    values.push(filters.actorUserId)
  }
  if (filters.category) {
    clauses.push('category = ?')
    values.push(filters.category)
  }
  if (filters.action) {
    clauses.push('action = ?')
    values.push(filters.action)
  }
  if (filters.resourceType) {
    clauses.push('resource_type = ?')
    values.push(filters.resourceType)
  }
  if (filters.resourceId) {
    clauses.push('resource_id = ?')
    values.push(filters.resourceId)
  }
  if (filters.outcome) {
    clauses.push('outcome = ?')
    values.push(filters.outcome)
  }
  if (filters.from) {
    clauses.push('created_at >= ?')
    values.push(filters.from)
  }
  if (filters.to) {
    clauses.push('created_at <= ?')
    values.push(filters.to)
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values
  }
}

export const listAuditEvents = (
  filters: AuditEventFilters = {},
  options: { page?: number; pageSize?: number } = {}
): AuditEventPage => {
  const page = Math.max(Math.trunc(options.page ?? 1), 1)
  const pageSize = Math.min(Math.max(Math.trunc(options.pageSize ?? 20), 1), 100)
  const where = auditWhere(filters)
  const client = openDatabase().client
  const total = (
    client.prepare(`SELECT COUNT(*) AS count FROM audit_events ${where.sql}`).get(...where.values) as {
      count: number
    }
  ).count
  const outcomeRows = client
    .prepare(`SELECT outcome, COUNT(*) AS count FROM audit_events ${where.sql} GROUP BY outcome`)
    .all(...where.values) as Array<{ outcome: AuditEventOutcome; count: number }>
  const lastEventAt =
    (
      client.prepare(`SELECT MAX(created_at) AS value FROM audit_events ${where.sql}`).get(...where.values) as {
        value: string | null
      }
    ).value ?? null
  const rows = client
    .prepare(
      `SELECT ${auditSelectColumns} FROM audit_events ${where.sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(...where.values, pageSize, (page - 1) * pageSize) as Array<{
    id: number
    actor_user_id: string | null
    actor_label: string
    action: string
    category: string
    resource_type: string | null
    resource_id: string | null
    resource_label: string | null
    outcome: AuditEventOutcome
    details_json: string
    source_ip: string | null
    user_agent: string | null
    created_at: string
  }>

  return {
    events: rows.map(parseAuditRow),
    total,
    page,
    pageSize,
    summary: {
      success: outcomeRows.find(row => row.outcome === 'success')?.count ?? 0,
      failure: outcomeRows.find(row => row.outcome === 'failure')?.count ?? 0,
      lastEventAt
    }
  }
}

export const listAuditFacetValues = () => {
  const client = openDatabase().client
  const values = (column: string) =>
    (
      client
        .prepare(`SELECT DISTINCT ${column} AS value FROM audit_events WHERE ${column} IS NOT NULL ORDER BY value`)
        .all() as Array<{
        value: string
      }>
    ).map(row => row.value)

  return {
    actors: client
      .prepare(
        [
          'SELECT DISTINCT actor_user_id AS id, actor_label AS label',
          'FROM audit_events',
          'WHERE actor_user_id IS NOT NULL',
          'ORDER BY actor_label'
        ].join(' ')
      )
      .all() as Array<{ id: string; label: string }>,
    categories: values('category'),
    actions: values('action'),
    resourceTypes: values('resource_type')
  }
}

export const exportAuditEvents = (filters: AuditEventFilters = {}, limit = 5000) => {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 10000)
  const where = auditWhere(filters)
  const rows = openDatabase()
    .client.prepare(
      `SELECT ${auditSelectColumns} FROM audit_events ${where.sql} ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(...where.values, boundedLimit) as Parameters<typeof parseAuditRow>[0][]

  return rows.map(parseAuditRow)
}

export const purgeAuditEvents = () => {
  const result = openDatabase().client.prepare('DELETE FROM audit_events').run()
  return result.changes
}

export const pruneAuditEventsOlderThan = (retentionDays: number) => {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) return 0
  const cutoff = new Date(Date.now() - Math.trunc(retentionDays) * 24 * 60 * 60 * 1000).toISOString()
  const result = openDatabase().client.prepare('DELETE FROM audit_events WHERE created_at < ?').run(cutoff)
  return result.changes
}

export const maybePruneAuditEvents = (retentionDays: number, intervalMs = 60 * 60 * 1000) => {
  const now = Date.now()
  if (now - lastAuditRetentionAt < intervalMs) return 0
  lastAuditRetentionAt = now
  return pruneAuditEventsOlderThan(retentionDays)
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
