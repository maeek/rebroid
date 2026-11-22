import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { requireFeature } from '../features'
import { revalidateOrchestratorPages } from '../shared'
import type { FeatureFlagKey } from '@/shared/contracts/feature-flags'

export const runAuditedPlatformAction = async <T>({
  action,
  details,
  feature,
  operation,
  response,
  resourceId,
  resourceType
}: {
  action: string
  details?: Record<string, unknown>
  feature?: FeatureFlagKey
  operation: () => Promise<T>
  response?: 'api'
  resourceId?: string
  resourceType: string
}) => {
  const admin = await requireAdmin(response)
  if (feature) await requireFeature(feature, response)
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
