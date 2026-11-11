import { AUTOMATION_AI_DEFAULT_CAPABILITIES_HEADER } from '@rebroid/automation-core/ai-run'
import { z } from 'zod'
import { hasInternalSecret } from '@/server/auth/internal-secret'
import { authorizeAutomationExecution } from '@/server/automations/authorize-execution'
import { PublicActionError } from '@/server/errors/public-action-error'
import { logger } from '@/server/observability/logger'
import { getRequestId } from '@/server/observability/request-id'
import { openAppQuotaHeaders } from '@/server/orchestrator/applications/open-app-quota'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
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
  const input = inputSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return new Response(null, { status: 400, headers: { 'x-request-id': requestId } })
  try {
    const { maxOpenApps, canUseInternet, defaultAiCapabilities } = await authorizeAutomationExecution(input.data)
    if (defaultAiCapabilities !== undefined && request.headers.get(AUTOMATION_AI_DEFAULT_CAPABILITIES_HEADER) !== '1') {
      return new Response(null, { status: 503, headers: { 'x-request-id': requestId } })
    }
    return new Response(null, {
      status: 204,
      headers: {
        'x-request-id': requestId,
        'x-rebroid-max-open-apps': 'unlimited',
        ...openAppQuotaHeaders(maxOpenApps),
        'x-rebroid-allow-broad-egress': String(canUseInternet),
        ...(defaultAiCapabilities === undefined
          ? {}
          : { [AUTOMATION_AI_DEFAULT_CAPABILITIES_HEADER]: defaultAiCapabilities.join(',') })
      }
    })
  } catch (error) {
    const denied =
      (error instanceof PublicActionError && ['forbidden', 'not_found', 'validation'].includes(error.code)) ||
      (error instanceof OrchestratorRequestError && error.status === 404)
    logger.warn(denied ? 'automation.authorization_rejected' : 'automation.authorization_unavailable', { requestId })
    return new Response(null, { status: denied ? 403 : 503, headers: { 'x-request-id': requestId } })
  }
}
