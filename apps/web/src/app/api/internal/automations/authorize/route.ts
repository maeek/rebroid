import { z } from 'zod'
import { hasInternalSecret } from '@/server/auth/internal-secret'
import { authorizeAutomationExecution } from '@/server/automations/authorize-execution'
import { logger } from '@/server/observability/logger'
import { getRequestId } from '@/server/observability/request-id'
import { openAppQuotaHeaders } from '@/server/orchestrator/applications/open-app-quota'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

const inputSchema = z
  .object({
    ownerUserId: z.string().min(1).max(200),
    targetApplicationId: z.string().min(1).max(200),
    definition: z.custom<AutomationDefinition>(value => Boolean(value && typeof value === 'object' && 'spec' in value)),
    profileMode: z.string().nullable().optional(),
    profileName: z.string().nullable().optional(),
    operation: z.enum(['attach', 'start'])
  })
  .strict()

export const POST = async (request: Request) => {
  if (!hasInternalSecret(request.headers)) return new Response(null, { status: 401 })
  const requestId = await getRequestId(request.headers.get('x-request-id'))
  try {
    const quota = await authorizeAutomationExecution(inputSchema.parse(await request.json()))
    return new Response(null, {
      status: 204,
      headers: { 'x-request-id': requestId, 'x-rebroid-max-open-apps': 'unlimited', ...openAppQuotaHeaders(quota) }
    })
  } catch {
    logger.warn('automation.authorization_rejected', { requestId })
    return new Response(null, { status: 403, headers: { 'x-request-id': requestId } })
  }
}
