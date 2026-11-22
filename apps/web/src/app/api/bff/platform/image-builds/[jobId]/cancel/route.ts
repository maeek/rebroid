import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, routeResourceId } from '@/server/http/route-input'
import { cancelImageBuild } from '@/server/platform/image-build-service'

export const POST = (_request: Request, context: { params: Promise<{ jobId: string }> }) =>
  runRouteHandler(async () => {
    const { jobId } = await context.params
    return cancelImageBuild(parseRouteInput(routeResourceId, jobId))
  })
