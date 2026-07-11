import { z } from 'zod'
import { readAutomationRunEvents } from '@/server/automations/run-events-service'
import { runRouteHandler } from '@/server/http/route-handler'

const runIdSchema = z.string().trim().min(1).max(128)
const afterSchema = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).catch(0)

export const GET = (request: Request, context: { params: Promise<{ runId: string }> }) =>
  runRouteHandler(async () => {
    const { runId } = await context.params
    const after = afterSchema.parse(new URL(request.url).searchParams.get('after') ?? 0)
    return readAutomationRunEvents(runIdSchema.parse(runId), after)
  })
