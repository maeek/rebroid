import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorPlatformClient } from '@/server/orchestrator/platform/client'
import { requireAdminUser } from '@/server/orchestrator/shared'

export const GET = (_request: Request, context: { params: Promise<{ jobId: string }> }) =>
  runRouteHandler(async () => {
    await requireAdminUser()
    const { jobId } = await context.params
    return orchestratorPlatformClient.getPlatformImagePull(z.uuid().parse(jobId))
  })
