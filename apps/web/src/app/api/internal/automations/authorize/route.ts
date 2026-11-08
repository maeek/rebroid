import { z } from 'zod'
import { hasInternalSecret } from '@/server/auth/internal-secret'
import { authorizeAutomationExecution } from '@/server/automations/authorize-execution'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

const inputSchema = z
  .object({
    ownerUserId: z.string().min(1).max(200),
    targetApplicationId: z.string().min(1).max(200),
    definition: z.custom<AutomationDefinition>(value => Boolean(value && typeof value === 'object' && 'spec' in value)),
    profileMode: z.string().nullable().optional(),
    profileName: z.string().nullable().optional(),
    startPolicy: z.enum(['require-running', 'start-if-needed']).optional()
  })
  .strict()

export const POST = async (request: Request) => {
  if (!hasInternalSecret(request.headers)) return new Response(null, { status: 401 })
  try {
    await authorizeAutomationExecution(inputSchema.parse(await request.json()))
    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 403 })
  }
}
