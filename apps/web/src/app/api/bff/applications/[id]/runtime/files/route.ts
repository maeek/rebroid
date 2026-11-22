import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'
import { readRuntimeFilePath } from '@/server/orchestrator/applications/runtime-file-path'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = async (request: Request, context: RouteContext) => {
  const { id } = await context.params
  return runRouteHandler(async () => {
    const path = readRuntimeFilePath(request, 'directory')
    await assertCanTransferApplicationFiles(id)
    return orchestratorAppRuntimeClient.listFiles(id, path, request.signal)
  })
}
