import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import 'server-only'
import {
  auditOrderBy,
  auditRetentionCutoff,
  auditSelectColumns,
  auditWhere,
  normalizeAuditDetails,
  normalizeAuditPagination,
  parseAuditRow
} from './audit-model'
import { initialWebSchema } from './migrations/0000-initial'
import type {
  AuditEventFilters,
  AuditEventInput,
  AuditEventOutcome,
  AuditEventPage,
  AuditEventRow,
  AuditEventSort
} from './audit-model'

export type {
  AuditEvent,
  AuditEventFilters,
  AuditEventInput,
  AuditEventOutcome,
  AuditEventPage,
  AuditEventSort,
  AuditEventSortField
} from './audit-model'

type WebDatabase = {
  client: Database.Database
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
  process.env.WEB_DATABASE_PATH || join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'web.sqlite')
const resetInstruction =
  'Reset stored state with "docker compose -f deploy/compose.yaml down -v" before starting Rebroid.'

const hasApplicationTables = (client: Database.Database) => {
  const result = client
    .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get() as { count: number }
  return result.count > 0
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

  if (schemaVersion === 0) {
    if (hasApplicationTables(client)) {
      client.close()
      throw new Error(`Unsupported web database schema version ${schemaVersion}. ${resetInstruction}`)
    }
    client.exec(initialWebSchema)
  } else if (schemaVersion !== 2) {
    client.close()
    throw new Error(`Unsupported web database schema version ${schemaVersion}. ${resetInstruction}`)
  }

  instance = { client }
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

export const listAuditEvents = (
  filters: AuditEventFilters = {},
  options: { page?: number; pageSize?: number; sorting?: AuditEventSort[] } = {}
): AuditEventPage => {
  const { page, pageSize } = normalizeAuditPagination(options.page, options.pageSize)
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
      `SELECT ${auditSelectColumns} FROM audit_events ${where.sql} ORDER BY ${auditOrderBy(
        options.sorting
      )} LIMIT ? OFFSET ?`
    )
    .all(...where.values, pageSize, (page - 1) * pageSize) as AuditEventRow[]

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
  const cutoff = auditRetentionCutoff(retentionDays)
  if (!cutoff) return 0
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
