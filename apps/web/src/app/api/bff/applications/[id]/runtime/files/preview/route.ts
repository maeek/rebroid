import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'

type RouteContext = { params: Promise<{ id: string }> }

const pathSchema = z.string().trim().min(1).max(4096).startsWith('/data/')

export const GET = async (request: Request, context: RouteContext) => {
  try {
    const { id } = await context.params
    const path = pathSchema.parse(new URL(request.url).searchParams.get('path'))
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
