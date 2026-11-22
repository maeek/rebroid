import { recordAuditEvent } from './events'

export const recordApplicationAudit = (
  actorUserId: string,
  action: `application.${string}`,
  app: { id: string; name?: string },
  details?: Record<string, unknown>
) =>
  recordAuditEvent({
    actorUserId,
    actorLabel: actorUserId,
    category: 'application',
    action,
    resourceType: 'application',
    resourceId: app.id,
    resourceLabel: app.name,
    details
  })
