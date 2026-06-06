import { recordAuditEvent } from '@/server/audit/events'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'

export const runAuditedPlatformAction = async <T>({
  action,
  details,
  operation,
  resourceId,
  resourceType
}: {
  action: string
  details?: Record<string, unknown>
  operation: () => Promise<T>
  resourceId: string
  resourceType: string
}) => {
  const admin = await requireAdminUser()
  const result = await operation()
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'docker',
    action,
    resourceType,
    resourceId,
    details
  })
  revalidateOrchestratorPages()
  return result
}
