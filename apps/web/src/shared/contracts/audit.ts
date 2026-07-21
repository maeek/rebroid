export type AuditEventOutcome = 'success' | 'failure'

export interface AuditEvent {
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

export interface AuditEventFilters {
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

export interface AuditEventPage {
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

export interface AuditEventSort {
  id: AuditEventSortField
  desc: boolean
}

export type AuditSearchParams = Record<string, string | string[] | undefined>
