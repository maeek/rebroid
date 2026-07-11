import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { getImageBuildJob } from '@/server/platform/image-build-service'

const jobIdSchema = z.string().trim().min(1).max(128)

export const GET = (_request: Request, context: { params: Promise<{ jobId: string }> }) =>
  runRouteHandler(async () => {
    const { jobId } = await context.params
    return getImageBuildJob(jobIdSchema.parse(jobId))
  })
