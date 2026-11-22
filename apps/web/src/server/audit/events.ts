import { after } from 'next/server'
import { logger } from '@/server/observability/logger'
import { appendAuditEvent, pruneAuditEventsOlderThan } from '@/server/persistence/audit-repository'
import { getWebSettings } from '@/server/web-settings/store'
import type { AuditEventInput } from '@/server/persistence/audit-model'

type RecordAuditEventInput = AuditEventInput & {
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

const retentionIntervalMs = 60 * 60 * 1000
let nextRetentionCheckAt = 0

const insertAuditEvent = async ({ retentionDays, ...event }: RecordAuditEventInput) => {
  appendAuditEvent({
    ...event,
    details: sanitize(event.details) as Record<string, unknown> | undefined
  })
  const now = Date.now()
  if (now < nextRetentionCheckAt) return
  nextRetentionCheckAt = now + retentionIntervalMs
  try {
    pruneAuditEventsOlderThan(retentionDays ?? (await getWebSettings()).auditRetentionDays)
  } catch (error) {
    nextRetentionCheckAt = 0
    throw error
  }
}

export const recordAuditEvent = (event: RecordAuditEventInput) => {
  const persist = () =>
    insertAuditEvent(event).catch(error => {
      logger.error('audit.record_failed', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    })
  try {
    after(persist)
  } catch {
    void Promise.resolve().then(persist)
  }
}
