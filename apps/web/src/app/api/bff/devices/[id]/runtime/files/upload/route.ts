import { runtimeFileUploadLimit } from '@rebroid/android-application-core/redroid-runtime'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput } from '@/server/http/route-input'
import { orchestratorAppRuntimeClient } from '@/server/orchestrator/applications/runtime-client'
import { assertCanTransferApplicationFiles } from '@/server/orchestrator/applications/runtime-file-access'
import { readRuntimeFilePath } from '@/server/orchestrator/applications/runtime-file-path'
import { prepareStreamingMultipartUpload } from '@/server/upload-proxy/streaming-upload'

type RouteContext = { params: Promise<{ id: string }> }

const overwriteSchema = z.enum(['true', 'false']).default('false')

export const runtime = 'nodejs'

export const POST = (request: NextRequest, context: RouteContext) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    const path = readRuntimeFilePath(request, 'directory')
    const overwrite =
      parseRouteInput(overwriteSchema, request.nextUrl.searchParams.get('overwrite') ?? 'false') === 'true'
    const { app, user } = await assertCanTransferApplicationFiles(id)
    const upload = prepareStreamingMultipartUpload(request, {
      maxBytes: runtimeFileUploadLimit.bytes,
      missingMessage: 'File is required.',
      tooLargeMessage: runtimeFileUploadLimit.message
    })
    const uploaded = await orchestratorAppRuntimeClient.uploadDataFileStream(
      id,
      upload.body,
      path,
      upload.contentType,
      overwrite,
      request.signal
    )
    recordApplicationAudit(
      user.ownerUserId,
      'application.file.upload',
      { id, name: app.name },
      { path: uploaded.path, name: uploaded.name, type: uploaded.type, overwrite }
    )
    return uploaded
  })
