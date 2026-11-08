import type { AuditEventPage, AuditEventSort, AuditFilterValues } from '@/shared/contracts/audit'

export type ActivityFacets = {
  actors: Array<{ id: string; label: string }>
  categories: string[]
  actions: string[]
  resourceTypes: string[]
}

export type ActivityFilterEntry = {
  key: keyof AuditFilterValues
  label: string
  value: string
}

export type ActivityEventsTableProps = {
  loading?: boolean
  application?: { id: string; name: string }
  result: AuditEventPage
  filters: AuditFilterValues
  sorting: AuditEventSort[]
  facets: ActivityFacets
  auditRetentionDays: number
}
