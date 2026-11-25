import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { readExternalWorkflowRun, readWorkflowTraceRun } from '@/server/orchestrator/automations/workflow-trace-query'

const selector = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)

export const GET = async (request: Request, context: { params: Promise<{ runId: string }> }) => {
  const response = await runRouteHandler(async () => {
    const runId = selector.safeParse((await context.params).runId)
    const params = new URL(request.url).searchParams
    const workflowId = selector.safeParse(params.get('workflow'))
    const attachment = z.uuid().nullable().safeParse(params.get('attachment'))
    if (!runId.success || !workflowId.success || !attachment.success) {
      throw new PublicActionError('Invalid workflow run request.', { code: 'validation', status: 400 })
    }
    return attachment.data
      ? readExternalWorkflowRun(workflowId.data, runId.data, attachment.data, request.signal)
      : readWorkflowTraceRun(workflowId.data, runId.data, request.signal)
  })
  response.headers.set('cache-control', 'private, no-store')
  return response
}
