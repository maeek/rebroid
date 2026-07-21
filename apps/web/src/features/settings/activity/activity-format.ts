import type { ActivityFacets, ActivityFilterEntry, ActivityFilterValues } from './activity-types'
import type { AuditEvent } from '@/shared/contracts/audit'

export const allActivityFilterValue = '__all__'

export const formatAction = (action: string) =>
  action
    .split('.')
    .map(value => value.charAt(0).toUpperCase() + value.slice(1))
    .join(' ')

export const formatDetails = (details: Record<string, unknown>) =>
  Object.keys(details).length === 0 ? 'none' : JSON.stringify(details, null, 2)

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

export const activityFilterEntries = (filters: ActivityFilterValues, facets: ActivityFacets): ActivityFilterEntry[] => {
  const entries: ActivityFilterEntry[] = []
  const add = (key: keyof ActivityFilterValues, label: string, value: string | undefined) => {
    if (value) entries.push({ key, label, value })
  }

  add('search', 'Search', filters.search)
  add(
    'actor',
    'Actor',
    filters.actor ? (facets.actors.find(actor => actor.id === filters.actor)?.label ?? filters.actor) : undefined
  )
  add('category', 'Category', filters.category)
  add('action', 'Action', filters.action ? formatAction(filters.action) : undefined)
  add('resourceType', 'Resource', filters.resourceType)
  add('outcome', 'Outcome', filters.outcome)
  add('from', 'From', dateInputValue(filters.from))
  add('to', 'To', dateInputValue(filters.to))

  return entries
}

export const outcomeTone = (outcome: AuditEvent['outcome']) => (outcome === 'failure' ? 'danger' : 'neutral')

export const metricNumber = (value: number) => new Intl.NumberFormat().format(value)

export const relativeTime = (value: string | null) => {
  if (!value) return 'No events yet'
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60]
  ]
  const [unit, divisor] = units.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? ['second', 1]
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / divisor), unit)
}

export const dateDaysAgo = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}
