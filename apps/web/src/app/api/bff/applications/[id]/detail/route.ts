import { z } from 'zod'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { refreshApplicationDetail } from '@/server/orchestrator/applications/application-detail-query'

const detailRevision = z
  .string()
  .regex(/^[a-f0-9]{64}\.[01]$/)
  .nullish()

export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const response = await runRouteHandler(async () => {
    const id = z.uuid().safeParse((await context.params).id)
    const revision = detailRevision.safeParse(new URL(request.url).searchParams.get('revision'))
    if (!id.success || !revision.success) {
      throw new PublicActionError('Invalid application detail request.', { code: 'validation', status: 400 })
    }
    return refreshApplicationDetail(id.data, revision.data ?? undefined, request.signal)
  })
  response.headers.set('cache-control', 'private, no-store')
  return response
}
