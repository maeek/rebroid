import { z } from 'zod'
import { listApplicationWorkflowRuns } from '@/server/automations/application-workflow-history-query'
import { runRouteHandler } from '@/server/http/route-handler'

const querySchema = z.object({
  page: z.coerce.number().int().min(0).max(100000).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(200).default('')
})

export const GET = (request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
    return listApplicationWorkflowRuns(z.string().trim().min(1).max(128).parse(id), query)
  })
