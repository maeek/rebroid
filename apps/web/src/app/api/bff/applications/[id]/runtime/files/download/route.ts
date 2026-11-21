import { z } from 'zod'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

const filePath = z.string().min(1).max(4096).startsWith('/data/')

export const GET = (request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    const path = filePath.safeParse(new URL(request.url).searchParams.get('path'))
    if (!path.success) {
      throw new PublicActionError('Choose a file to download.', { code: 'validation', status: 400 })
    }
    const { app, user } = await assertCanTransferApplicationFiles(id)
    const result = await orchestratorAppRuntimeClient
      .downloadRuntimeFile(id, path.data, request.signal)
      .catch((error: unknown) => {
        if (error instanceof OrchestratorRequestError && error.status === 413) {
          throw new PublicActionError('File downloads are limited to 25 MiB.', { code: 'validation', status: 413 })
        }
        throw error
      })
    recordAuditEvent({
      actorUserId: user.ownerUserId,
      actorLabel: user.ownerUserId,
      category: 'application',
      action: 'application.file.download',
      resourceType: 'application',
      resourceId: id,
      resourceLabel: app.name,
      details: { path: path.data, name: result.name, type: 'file' }
    })
    return result
  })
