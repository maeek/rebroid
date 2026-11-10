import { z } from 'zod'
import { hasInternalSecret } from '@/server/auth/internal-secret'
import { authorizeAutomationExecution } from '@/server/automations/authorize-execution'
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
  try {
    const quota = await authorizeAutomationExecution(inputSchema.parse(await request.json()))
    return new Response(null, {
      status: 204,
      headers: { 'x-rebroid-max-open-apps': 'unlimited', ...openAppQuotaHeaders(quota) }
    })
  } catch {
    return new Response(null, { status: 403 })
  }
}
