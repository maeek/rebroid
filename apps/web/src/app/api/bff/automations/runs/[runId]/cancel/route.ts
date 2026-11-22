import { cancelAutomationRun } from '@/server/automations/run-events-service'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, routeResourceId } from '@/server/http/route-input'

export const POST = (_request: Request, context: { params: Promise<{ runId: string }> }) =>
  runRouteHandler(async () => {
    const { runId } = await context.params
    return cancelAutomationRun(parseRouteInput(routeResourceId, runId))
  })
