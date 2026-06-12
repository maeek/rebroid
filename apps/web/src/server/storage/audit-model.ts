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

export type AuditEventSortField = 'createdAt' | 'actorLabel' | 'action' | 'category' | 'outcome' | 'resourceLabel'
export type AuditEventSort = { id: AuditEventSortField; desc: boolean }

export type AuditEventRow = {
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
}

export const normalizeAuditDetails = (details: Record<string, unknown> | undefined) =>
  JSON.stringify(details ?? {}, (_key, value: unknown) => {
    if (typeof value === 'bigint') return value.toString()
    return value
  })

export const parseAuditRow = (row: AuditEventRow): AuditEvent => ({
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

export const auditSelectColumns = [
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

export const auditWhere = (filters: AuditEventFilters = {}) => {
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

const auditSortColumns: Record<AuditEventSortField, string> = {
  createdAt: 'created_at',
  actorLabel: 'actor_label',
  action: 'action',
  category: 'category',
  outcome: 'outcome',
  resourceLabel: 'resource_label'
}

export const auditOrderBy = (sorting: AuditEventSort[] = []) => {
  const clauses = sorting
    .map(sort => {
      const column = auditSortColumns[sort.id]
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
