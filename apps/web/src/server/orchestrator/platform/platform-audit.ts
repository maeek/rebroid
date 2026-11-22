import { recordAuditEvent } from '@/server/audit/events'
import { requireFeature } from '../features'
import { revalidateOrchestratorPages, requireAdminUser } from '../shared'
import type { FeatureFlagKey } from '@/shared/contracts/feature-flags'

export const runAuditedPlatformAction = async <T>({
  action,
  details,
  feature,
  operation,
  resourceId,
  resourceType
}: {
  action: string
  details?: Record<string, unknown>
  feature?: FeatureFlagKey
  operation: () => Promise<T>
  resourceId?: string
  resourceType: string
}) => {
  const admin = await requireAdminUser()
  if (feature) await requireFeature(feature)
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
