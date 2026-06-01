import { appendAuditEvent } from '@/server/storage/database'

export const recordAuditEvent = (
  actorUserId: string,
  action: string,
  subject?: string,
  details?: Record<string, unknown>
) => appendAuditEvent(action, { actorUserId, subject, details })
