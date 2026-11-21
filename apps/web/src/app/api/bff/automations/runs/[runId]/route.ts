import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { readWorkflowTraceRun } from '@/server/orchestrator/automations/workflow-trace-query'

const selector = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)

export const GET = async (request: Request, context: { params: Promise<{ runId: string }> }) => {
  const response = await runRouteHandler(async () => {
    const runId = selector.safeParse((await context.params).runId)
    const workflowId = selector.safeParse(new URL(request.url).searchParams.get('workflow'))
    if (!runId.success || !workflowId.success) {
      throw new PublicActionError('Invalid workflow run request.', { code: 'validation', status: 400 })
    }
    return readWorkflowTraceRun(workflowId.data, runId.data, request.signal)
  })
  response.headers.set('cache-control', 'private, no-store')
  return response
}
