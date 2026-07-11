import { after } from 'next/server'
import { logger } from '@/server/observability/logger'
import { appendAuditEvent, maybePruneAuditEvents, type AuditEventInput } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'

export type RecordAuditEventInput = AuditEventInput & {
  retentionDays?: number
}

const sensitiveKeyFragments = ['password', 'token', 'secret', 'authorization', 'cookie', 'apikey', 'credential']

const isSensitiveKey = (key: string) => {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
  return sensitiveKeyFragments.some(fragment => normalized.includes(fragment))
}

const sanitize = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sanitize)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[redacted]' : sanitize(item)
    ])
  )
}

const insertAuditEvent = async ({ retentionDays, ...event }: RecordAuditEventInput) => {
  appendAuditEvent({
    ...event,
    details: sanitize(event.details) as Record<string, unknown> | undefined
  })
  const configuredRetentionDays = retentionDays ?? (await getWebSettings()).auditRetentionDays
  maybePruneAuditEvents(configuredRetentionDays)
}

export const recordAuditEvent = (event: RecordAuditEventInput) => {
  try {
    after(async () => {
      try {
        await insertAuditEvent(event)
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
