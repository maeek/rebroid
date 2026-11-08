import { auditActionLabel, auditValueLabel } from '@/shared/model/audit-event-presentation'
import type { ActivityFacets, ActivityFilterEntry } from './activity-types'
import type { AuditEvent, AuditFilterValues } from '@/shared/contracts/audit'

export const allActivityFilterValue = '__all__'

export const dateInputValue = (value: string | undefined) => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export const compactActivityParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text) params.set(key, text)
  }
  return params
}

export const activityFilterEntries = (filters: AuditFilterValues, facets: ActivityFacets): ActivityFilterEntry[] => {
  const entries: ActivityFilterEntry[] = []
  const add = (key: keyof AuditFilterValues, label: string, value: string | undefined) => {
    if (value) entries.push({ key, label, value })
  }

  add('search', 'Search', filters.search)
  add(
    'actor',
    'Actor',
    filters.actor ? (facets.actors.find(actor => actor.id === filters.actor)?.label ?? filters.actor) : undefined
  )
  add('category', 'Category', filters.category ? auditValueLabel(filters.category) : undefined)
  add('action', 'Action', filters.action ? auditActionLabel(filters.action) : undefined)
  add('resourceType', 'Resource', filters.resourceType ? auditValueLabel(filters.resourceType) : undefined)
  add('resourceId', 'Resource ID', filters.resourceId)
  add('outcome', 'Outcome', filters.outcome ? auditValueLabel(filters.outcome) : undefined)
  add('from', 'From (UTC)', dateInputValue(filters.from))
  add('to', 'To (UTC)', dateInputValue(filters.to))

  return entries
}

export const outcomeTone = (outcome: AuditEvent['outcome']) => (outcome === 'failure' ? 'danger' : 'neutral')

export const metricNumber = (value: number) => new Intl.NumberFormat().format(value)
