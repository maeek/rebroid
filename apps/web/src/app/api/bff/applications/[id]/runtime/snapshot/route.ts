import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { readApplicationRuntimeSnapshot } from '@/server/orchestrator/applications/runtime-snapshot-query'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = async (request: Request, context: RouteContext) => {
  const response = await runRouteHandler(async () => {
    const id = z.uuid().safeParse((await context.params).id)
    if (!id.success) {
      throw new PublicActionError('Invalid application ID.', { code: 'validation', status: 400 })
    }
    return readApplicationRuntimeSnapshot(id.data, request.signal)
  })
  response.headers.set('cache-control', 'private, no-store')
  return response
}
