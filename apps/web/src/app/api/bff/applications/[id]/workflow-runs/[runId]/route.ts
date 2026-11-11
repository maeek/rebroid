import { z } from 'zod'
import { readApplicationWorkflowRun } from '@/server/automations/application-workflow-history-query'
import { runRouteHandler } from '@/server/http/route-handler'

export const GET = (_request: Request, context: { params: Promise<{ id: string; runId: string }> }) =>
  runRouteHandler(async () => {
    const { id, runId } = await context.params
    return readApplicationWorkflowRun(z.string().trim().min(1).max(128).parse(id), z.uuid().parse(runId))
  })
