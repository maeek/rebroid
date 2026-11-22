import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, routeResourceId } from '@/server/http/route-input'
import { getImageBuildJob } from '@/server/platform/image-build-service'

export const GET = (_request: Request, context: { params: Promise<{ jobId: string }> }) =>
  runRouteHandler(async () => {
    const { jobId } = await context.params
    return getImageBuildJob(parseRouteInput(routeResourceId, jobId))
  })
