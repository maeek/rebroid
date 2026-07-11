import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { cancelImageBuild } from '@/server/platform/image-build-service'

const jobIdSchema = z.string().trim().min(1).max(128)

export const POST = (_request: Request, context: { params: Promise<{ jobId: string }> }) =>
  runRouteHandler(async () => {
    const { jobId } = await context.params
    return cancelImageBuild(jobIdSchema.parse(jobId))
  })
