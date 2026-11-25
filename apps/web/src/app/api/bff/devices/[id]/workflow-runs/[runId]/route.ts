import { z } from 'zod'
import { readApplicationWorkflowRun } from '@/server/automations/application-workflow-history-query'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, routeResourceId } from '@/server/http/route-input'

export const GET = (request: Request, context: { params: Promise<{ id: string; runId: string }> }) =>
  runRouteHandler(async () => {
    const { id, runId } = await context.params
    return readApplicationWorkflowRun(
      parseRouteInput(routeResourceId, id),
      parseRouteInput(z.uuid(), runId),
      request.signal
    )
  })
