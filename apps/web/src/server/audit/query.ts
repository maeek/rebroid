import { firstSearchParamValue, positiveIntegerSearchParam } from '@/shared/model/search-params'
import type {
  AuditEvent,
  AuditEventFilters,
  AuditFilterValues,
  AuditEventSort,
  AuditEventSortField,
  AuditSearchParams
} from '@/shared/contracts/audit'

const auditSortFields = new Set<AuditEventSortField>([
  'createdAt',
  'actorLabel',
  'action',
  'category',
  'outcome',
  'resourceLabel'
])

const isoDateParam = (value: string | undefined, boundary: 'start' | 'end') => {
  const text = value?.trim()
  if (!text) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return undefined
    if (boundary === 'end') date.setUTCHours(23, 59, 59, 999)
    return date.toISOString()
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export const auditFilterValuesFromFilters = (filters: AuditEventFilters): AuditFilterValues => ({
  search: filters.search,
  actor: filters.actorUserId,
  category: filters.category,
  action: filters.action,
  resourceType: filters.resourceType,
  resourceId: filters.resourceId,
  outcome: filters.outcome,
  from: filters.from,
  to: filters.to
})

export const auditFiltersFromSearchParams = (searchParams: AuditSearchParams): AuditEventFilters => {
  const outcome = firstSearchParamValue(searchParams.outcome)
  return {
    search: firstSearchParamValue(searchParams.search)?.trim() || undefined,
    actorUserId: firstSearchParamValue(searchParams.actor)?.trim() || undefined,
    category: firstSearchParamValue(searchParams.category)?.trim() || undefined,
    action: firstSearchParamValue(searchParams.action)?.trim() || undefined,
    resourceType: firstSearchParamValue(searchParams.resourceType)?.trim() || undefined,
    resourceId: firstSearchParamValue(searchParams.resourceId)?.trim() || undefined,
    outcome: outcome === 'success' || outcome === 'failure' ? outcome : undefined,
    from: isoDateParam(firstSearchParamValue(searchParams.from), 'start'),
    to: isoDateParam(firstSearchParamValue(searchParams.to), 'end')
  }
}

export const auditPageFromSearchParams = (searchParams: AuditSearchParams) => ({
  page: positiveIntegerSearchParam(searchParams.page, { fallback: 1 }),
  pageSize: positiveIntegerSearchParam(searchParams.pageSize, { fallback: 20, max: 100 })
})

export const auditSortFromSearchParams = (searchParams: AuditSearchParams): AuditEventSort[] => {
  const sort = firstSearchParamValue(searchParams.sort)
  const sorting = (sort ?? '')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!auditSortFields.has(id as AuditEventSortField) || !['asc', 'desc'].includes(direction)) return null
      return { id: id as AuditEventSortField, desc: direction === 'desc' }
    })
    .filter((item): item is AuditEventSort => Boolean(item))
    .slice(0, 3)
  return sorting.length ? sorting : [{ id: 'createdAt', desc: true }]
}

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
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
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
