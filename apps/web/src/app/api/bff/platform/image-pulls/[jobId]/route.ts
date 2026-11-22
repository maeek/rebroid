import { z } from 'zod'
import { requireAdmin } from '@/server/auth/authorization'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorPlatformClient } from '@/server/orchestrator/platform/client'

export const GET = (_request: Request, context: { params: Promise<{ jobId: string }> }) =>
  runRouteHandler(async () => {
    await requireAdmin('api')
    const { jobId } = await context.params
    return orchestratorPlatformClient.getPlatformImagePull(z.uuid().parse(jobId))
  })
