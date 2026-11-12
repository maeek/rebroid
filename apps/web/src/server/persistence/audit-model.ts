import { auditActionsMatchingSearch } from '@/shared/model/audit-event-presentation'
import type {
  AuditEvent,
  AuditEventFilters,
  AuditEventOutcome,
  AuditEventSort,
  AuditEventSortField
} from '@/shared/contracts/audit'

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

export type AuditEventRow = {
  id: number
  actor_user_id: string | null
  actor_username?: string | null
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
}

export const normalizeAuditDetails = (details: Record<string, unknown> | undefined) =>
  JSON.stringify(details ?? {}, (_key, value: unknown) => {
    if (typeof value === 'bigint') return value.toString()
    return value
  })

export const parseAuditRow = (row: AuditEventRow): AuditEvent => ({
  id: row.id,
  actorUserId: row.actor_user_id,
  actorUsername: row.actor_username,
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

export const auditSelectColumns = [
  'id',
  'actor_user_id',
  'actor_username',
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

export const auditEventsWithActors =
  'audit_events LEFT JOIN (SELECT id AS actor_user_id, username AS actor_username FROM users) USING (actor_user_id)'

export const auditActorName = 'coalesce(actor_username, actor_label)'

export const auditWhere = (filters: AuditEventFilters = {}) => {
  const clauses: string[] = []
  const values: Array<string> = []
  const search = filters.search?.trim()
  if (search) {
    const pattern = `%${search.toLowerCase()}%`
    const actions = auditActionsMatchingSearch(search)
    const matches = [
      'lower(action) LIKE ?',
      'lower(category) LIKE ?',
      'lower(actor_label) LIKE ?',
      "lower(coalesce(actor_username, '')) LIKE ?",
      "lower(coalesce(actor_user_id, '')) LIKE ?",
      "lower(coalesce(resource_type, '')) LIKE ?",
      "lower(coalesce(resource_id, '')) LIKE ?",
      "lower(coalesce(resource_label, '')) LIKE ?",
      'lower(details_json) LIKE ?',
      "lower(replace(replace(action, '.', ' '), '_', ' ')) LIKE ?"
    ]
    values.push(...matches.map(() => pattern), ...actions)
    if (actions.length) matches.push(`action IN (${actions.map(() => '?').join(', ')})`)
    clauses.push(`(${matches.join(' OR ')})`)
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

const auditSortColumns: Record<AuditEventSortField, string> = {
  createdAt: 'created_at',
  actorLabel: auditActorName,
  action: 'action',
  category: 'category',
  outcome: 'outcome',
  resourceLabel: 'resource_label'
}

export const auditOrderBy = (sorting: AuditEventSort[] = []) => {
  const clauses = sorting
    .map(sort => {
      const column = Object.hasOwn(auditSortColumns, sort.id) ? auditSortColumns[sort.id] : undefined
      return column ? `${column} ${sort.desc ? 'DESC' : 'ASC'}` : null
    })
    .filter((clause): clause is string => Boolean(clause))

  return clauses.length > 0 ? `${clauses.join(', ')}, id DESC` : 'created_at DESC, id DESC'
}

export const normalizeAuditPagination = (page: number | undefined, pageSize: number | undefined) => ({
  page: Math.max(Math.trunc(page ?? 1), 1),
  pageSize: Math.min(Math.max(Math.trunc(pageSize ?? 20), 1), 100)
})

export const auditRetentionCutoff = (retentionDays: number, now = Date.now()) => {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) return null

  return new Date(now - Math.trunc(retentionDays) * 24 * 60 * 60 * 1000).toISOString()
}
