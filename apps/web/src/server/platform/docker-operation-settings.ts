import 'server-only'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { request } from '@/server/orchestrator/request'
import { dockerOperationLimitsSchema } from '@/shared/contracts/docker-operation-limits'

const path = '/platform/docker/operation-limits'

export const readDockerOperationLimits = async () => {
  await requireAdmin()
  return request(path, undefined, dockerOperationLimitsSchema)
}

export const saveDockerOperationLimits = async (input: unknown) => {
  const admin = await requireAdmin()
  const parsed = dockerOperationLimitsSchema.safeParse(input)
  if (!parsed.success)
    throw new PublicActionError('Enter valid Docker operation limits.', { code: 'validation', status: 400 })
  const result = await request(path, { method: 'PUT', body: JSON.stringify(parsed.data) }, dockerOperationLimitsSchema)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.docker_limits.update',
    resourceType: 'docker_operation_limits',
    details: result
  })
  return result
}
