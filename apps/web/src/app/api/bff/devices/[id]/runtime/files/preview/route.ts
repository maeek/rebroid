import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'
import { readRuntimeFilePath } from '@/server/orchestrator/applications/runtime-file-path'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = async (request: Request, context: RouteContext) => {
  try {
    const { id } = await context.params
    const path = readRuntimeFilePath(request, 'file')
    await assertCanTransferApplicationFiles(id)
    const preview = await orchestratorAppRuntimeClient.previewRuntimeFile(id, path, request.signal)
    return new Response(preview.body, {
      headers: {
        'cache-control': 'private, max-age=300',
        'content-type': preview.headers.get('content-type') ?? 'image/webp'
      }
    })
  } catch (error) {
    return runRouteHandler(() => {
      throw error
    })
  }
}
