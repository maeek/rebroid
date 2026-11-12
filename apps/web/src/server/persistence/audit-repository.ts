import 'server-only'
import { auditExportLimit } from '@/shared/model/audit-export'
import {
  auditActorName,
  auditEventsWithActors,
  auditOrderBy,
  auditRetentionCutoff,
  auditSelectColumns,
  auditWhere,
  normalizeAuditDetails,
  normalizeAuditPagination,
  parseAuditRow
} from './audit-model'
import { getDatabase } from './database'
import type { AuditEventInput, AuditEventRow } from './audit-model'
import type { AuditEventFilters, AuditEventOutcome, AuditEventPage, AuditEventSort } from '@/shared/contracts/audit'

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
  const { page: requestedPage, pageSize } = normalizeAuditPagination(options.page, options.pageSize)
  const where = auditWhere(filters)
  const client = getDatabase()
  const total = (
    client.prepare(`SELECT COUNT(*) AS count FROM ${auditEventsWithActors} ${where.sql}`).get(...where.values) as {
      count: number
    }
  ).count
  const page = Math.min(requestedPage, Math.max(Math.ceil(total / pageSize), 1))
  const outcomeRows = client
    .prepare(`SELECT outcome, COUNT(*) AS count FROM ${auditEventsWithActors} ${where.sql} GROUP BY outcome`)
    .all(...where.values) as Array<{ outcome: AuditEventOutcome; count: number }>
  const lastEventAt =
    (
      client
        .prepare(`SELECT MAX(created_at) AS value FROM ${auditEventsWithActors} ${where.sql}`)
        .get(...where.values) as {
        value: string | null
      }
    ).value ?? null
  const rows = client
    .prepare(
      `SELECT ${auditSelectColumns} FROM ${auditEventsWithActors} ${where.sql} ORDER BY ${auditOrderBy(
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
        `SELECT actor_user_id AS id, ${auditActorName} AS label FROM ${auditEventsWithActors}
         WHERE audit_events.id IN (
           SELECT MAX(id) FROM audit_events WHERE actor_user_id IS NOT NULL GROUP BY actor_user_id
         ) ORDER BY label, actor_user_id`
      )
      .all() as Array<{ id: string; label: string }>,
    categories: values('category'),
    actions: values('action'),
    resourceTypes: values('resource_type')
  }
}

export const exportAuditEvents = (
  filters: AuditEventFilters = {},
  options: { limit?: number; sorting?: AuditEventSort[] } = {}
) => {
  const boundedLimit = Math.min(Math.max(Math.trunc(options.limit ?? auditExportLimit), 1), 10_000)
  const where = auditWhere(filters)
  const rows = getDatabase()
    .prepare(
      `SELECT ${auditSelectColumns} FROM ${auditEventsWithActors} ${where.sql}
       ORDER BY ${auditOrderBy(options.sorting)} LIMIT ?`
    )
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
