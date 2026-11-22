import { z } from 'zod'
import { readAutomationRunEvents, subscribeToAutomationRunEvents } from '@/server/automations/run-events-service'
import { runRouteHandler } from '@/server/http/route-handler'

const runIdSchema = z.string().trim().min(1).max(128)
const afterSchema = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).catch(0)

const afterSequence = (request: Request) => afterSchema.parse(new URL(request.url).searchParams.get('after') ?? 0)

export const GET = (request: Request, context: { params: Promise<{ runId: string }> }) =>
  runRouteHandler(async () => {
    const { runId } = await context.params
    return readAutomationRunEvents(runIdSchema.parse(runId), afterSequence(request), request.signal)
  })

export const POST = (request: Request, context: { params: Promise<{ runId: string }> }) =>
  runRouteHandler(async () => {
    const { runId } = await context.params
    return subscribeToAutomationRunEvents(runIdSchema.parse(runId), afterSequence(request), request.signal)
  })
