import { z } from 'zod'
import { cancelAutomationRun } from '@/server/automations/run-events-service'
import { runRouteHandler } from '@/server/http/route-handler'

const runIdSchema = z.string().trim().min(1).max(128)

export const POST = (_request: Request, context: { params: Promise<{ runId: string }> }) =>
  runRouteHandler(async () => {
    const { runId } = await context.params
    return cancelAutomationRun(runIdSchema.parse(runId))
  })
