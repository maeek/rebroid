import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'

type RouteContext = { params: Promise<{ id: string }> }

const pathSchema = z.string().trim().min(1).max(4096).startsWith('/data')

export const GET = async (request: Request, context: RouteContext) => {
  const { id } = await context.params
  return runRouteHandler(async () => {
    const path = pathSchema.parse(new URL(request.url).searchParams.get('path') ?? '/data')
    await assertCanTransferApplicationFiles(id)
    return orchestratorAppRuntimeClient.listFiles(id, path, request.signal)
  })
}
