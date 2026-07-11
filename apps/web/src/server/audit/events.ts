import { after } from 'next/server'
import { logger } from '@/server/observability/logger'
import { appendAuditEvent, maybePruneAuditEvents, type AuditEventInput } from '@/server/persistence/audit-repository'

export type RecordAuditEventInput = AuditEventInput & {
  retentionDays?: number
}

const sensitiveKeys = new Set(['password', 'token', 'secret', 'authorization', 'cookie', 'set-cookie'])

const sanitize = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sanitize)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? '[redacted]' : sanitize(item)
    ])
  )
}

const insertAuditEvent = ({ retentionDays, ...event }: RecordAuditEventInput) => {
  appendAuditEvent({
    ...event,
    details: sanitize(event.details) as Record<string, unknown> | undefined
  })
  if (retentionDays) {
    maybePruneAuditEvents(retentionDays)
  }
}

export const recordAuditEvent = (event: RecordAuditEventInput) => {
  try {
    after(() => {
      try {
        insertAuditEvent(event)
      } catch (error) {
        logger.error('audit.record_failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError'
        })
      }
    })
  } catch {
    void Promise.resolve()
      .then(() => insertAuditEvent(event))
      .catch(error => {
        logger.error('audit.record_failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError'
        })
      })
  }
}
