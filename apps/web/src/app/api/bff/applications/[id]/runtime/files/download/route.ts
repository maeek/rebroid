import { recordApplicationAudit } from '@/server/audit/application-event'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'
import { readRuntimeFilePath } from '@/server/orchestrator/applications/runtime-file-path'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

export const GET = (request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    const path = readRuntimeFilePath(request, 'file')
    const { app, user } = await assertCanTransferApplicationFiles(id)
    const result = await orchestratorAppRuntimeClient
      .downloadRuntimeFile(id, path, request.signal)
      .catch((error: unknown) => {
        if (error instanceof OrchestratorRequestError && error.status === 413) {
          throw new PublicActionError('File downloads are limited to 25 MiB.', { code: 'validation', status: 413 })
        }
        throw error
      })
    recordApplicationAudit(
      user.ownerUserId,
      'application.file.download',
      { id, name: app.name },
      { path, name: result.name, type: 'file' }
    )
    return result
  })
