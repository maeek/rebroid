import { z } from 'zod'
import { listApplicationWorkflowRuns } from '@/server/automations/application-workflow-history-query'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, routeResourceId } from '@/server/http/route-input'

const querySchema = z.object({
  page: z.coerce.number().int().min(0).max(100000).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(200).default('')
})

export const GET = (request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    const query = parseRouteInput(querySchema, Object.fromEntries(new URL(request.url).searchParams))
    return listApplicationWorkflowRuns(parseRouteInput(routeResourceId, id), query)
  })
