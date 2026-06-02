import type { AuditEventPage } from '@/server/storage/database'

export type ActivityFilterValues = {
  search?: string
  actor?: string
  category?: string
  action?: string
  resourceType?: string
  outcome?: string
  from?: string
  to?: string
}

export type ActivityFacets = {
  actors: Array<{ id: string; label: string }>
  categories: string[]
  actions: string[]
  resourceTypes: string[]
}

export type ActivityFilterEntry = {
  key: keyof ActivityFilterValues
  label: string
  value: string
}

export type ActivityEventsTableProps = {
  result: AuditEventPage
  filters: ActivityFilterValues
  facets: ActivityFacets
  auditRetentionDays: number
}
