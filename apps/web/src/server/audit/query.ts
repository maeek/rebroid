import { exportAuditEvents, type AuditEvent, type AuditEventFilters } from '@/server/storage/database'

export type AuditSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const isoDateParam = (value: string | undefined, boundary: 'start' | 'end') => {
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`).toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export const auditFiltersFromSearchParams = (searchParams: AuditSearchParams): AuditEventFilters => {
  const outcome = firstValue(searchParams.outcome)
  return {
    search: firstValue(searchParams.search)?.trim() || undefined,
    actorUserId: firstValue(searchParams.actor)?.trim() || undefined,
    category: firstValue(searchParams.category)?.trim() || undefined,
    action: firstValue(searchParams.action)?.trim() || undefined,
    resourceType: firstValue(searchParams.resourceType)?.trim() || undefined,
    resourceId: firstValue(searchParams.resourceId)?.trim() || undefined,
    outcome: outcome === 'success' || outcome === 'failure' ? outcome : undefined,
    from: isoDateParam(firstValue(searchParams.from), 'start'),
    to: isoDateParam(firstValue(searchParams.to), 'end')
  }
}

export const auditPageFromSearchParams = (searchParams: AuditSearchParams) => ({
  page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
  pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100)
})

const csvCell = (value: unknown) => {
  let text: string
  if (value === null || value === undefined) {
    text = ''
  } else if (typeof value === 'object') {
    text = JSON.stringify(value)
  } else if (typeof value === 'string') {
    text = value
  } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    text = String(value)
  } else {
    text = ''
  }
  return `"${text.replaceAll('"', '""')}"`
}

export const auditEventsToCsv = (events: AuditEvent[]) => {
  const headers = [
    'id',
    'created_at_utc',
    'actor_user_id',
    'actor_label',
    'category',
    'action',
    'outcome',
    'resource_type',
    'resource_id',
    'resource_label',
    'source_ip',
    'user_agent',
    'details_json'
  ]
  const rows = events.map(event => [
    event.id,
    event.createdAt,
    event.actorUserId,
    event.actorLabel,
    event.category,
    event.action,
    event.outcome,
    event.resourceType,
    event.resourceId,
    event.resourceLabel,
    event.sourceIp,
    event.userAgent,
    JSON.stringify(event.details)
  ])
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}

export const exportAuditEventsCsv = (filters: AuditEventFilters) => auditEventsToCsv(exportAuditEvents(filters))
