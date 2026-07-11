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
import { getDatabase } from './database'
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

let lastRetentionAt = 0

export const appendAuditEvent = (input: AuditEventInput) => {
  getDatabase()
    .prepare(
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
  const client = getDatabase()
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
  const client = getDatabase()
  const values = (column: 'category' | 'action' | 'resource_type') =>
    (
      client
        .prepare(`SELECT DISTINCT ${column} AS value FROM audit_events WHERE ${column} IS NOT NULL ORDER BY value`)
        .all() as Array<{ value: string }>
    ).map(row => row.value)

  return {
    actors: client
      .prepare(
        'SELECT DISTINCT actor_user_id AS id, actor_label AS label FROM audit_events WHERE actor_user_id IS NOT NULL ORDER BY actor_label'
      )
      .all() as Array<{ id: string; label: string }>,
    categories: values('category'),
    actions: values('action'),
    resourceTypes: values('resource_type')
  }
}

export const exportAuditEvents = (filters: AuditEventFilters = {}, limit = 5000) => {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 10_000)
  const where = auditWhere(filters)
  const rows = getDatabase()
    .prepare(`SELECT ${auditSelectColumns} FROM audit_events ${where.sql} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(...where.values, boundedLimit) as Parameters<typeof parseAuditRow>[0][]
  return rows.map(parseAuditRow)
}

export const purgeAuditEvents = () => getDatabase().prepare('DELETE FROM audit_events').run().changes

export const pruneAuditEventsOlderThan = (retentionDays: number) => {
  const cutoff = auditRetentionCutoff(retentionDays)
  if (!cutoff) return 0
  return getDatabase().prepare('DELETE FROM audit_events WHERE created_at < ?').run(cutoff).changes
}

export const maybePruneAuditEvents = (retentionDays: number, intervalMs = 60 * 60 * 1000) => {
  const now = Date.now()
  if (now - lastRetentionAt < intervalMs) return 0
  lastRetentionAt = now
  return pruneAuditEventsOlderThan(retentionDays)
}
