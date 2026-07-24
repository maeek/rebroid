import { NextRequest } from 'next/server'
import { z } from 'zod'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'
import { prepareStreamingMultipartUpload } from '@/server/upload-proxy/streaming-upload'

type RouteContext = { params: Promise<{ id: string }> }

const pathSchema = z.string().trim().min(1).max(4096).startsWith('/data')
const overwriteSchema = z.enum(['true', 'false']).default('false')
const maxRuntimeUploadBytes = 512 * 1024 * 1024

export const runtime = 'nodejs'

export const POST = async (request: NextRequest, context: RouteContext) => {
  try {
    const { id } = await context.params
    const path = pathSchema.parse(request.nextUrl.searchParams.get('path') ?? '/data')
    const overwrite = overwriteSchema.parse(request.nextUrl.searchParams.get('overwrite') ?? 'false') === 'true'
    const { app, user } = await assertCanTransferApplicationFiles(id)
    const upload = prepareStreamingMultipartUpload(request, {
      maxBytes: maxRuntimeUploadBytes,
      missingMessage: 'File is required.',
      tooLargeMessage: 'File upload exceeds the 512 MB limit.'
    })
    if (!upload.ok) {
      const tooLarge = upload.response.status === 413
      throw new PublicActionError(tooLarge ? 'File upload exceeds the 512 MB limit.' : 'File is required.', {
        code: 'validation',
        status: upload.response.status
      })
    }

    return runRouteHandler(async () => {
      const uploaded = await orchestratorAppRuntimeClient.uploadDataFileStream(
        id,
        upload.body,
        path,
        upload.contentType,
        overwrite,
        request.signal
      )
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.file.upload',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: app.name,
        details: { path: uploaded.path, name: uploaded.name, type: uploaded.type, overwrite }
      })
      return uploaded
    })
  } catch (error) {
    return runRouteHandler(() => {
      throw error
    })
  }
}
