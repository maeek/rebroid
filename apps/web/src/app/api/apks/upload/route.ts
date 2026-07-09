import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent } from '@/server/audit/events'
import { orchestratorApkUploadsClient } from '@/server/orchestrator/applications/apk-client'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { consumeRateLimit } from '@/server/rate-limit/in-memory'
import { prepareStreamingMultipartUpload } from '@/server/upload-proxy/streaming-upload'
import { getApkRouteUser } from '../apk-route-auth'

export const runtime = 'nodejs'
const maxApkUploadBytes = 512 * 1024 * 1024
const maxMultipartOverheadBytes = 1024 * 1024

export const POST = async (request: NextRequest) => {
  const { user, response } = await getApkRouteUser()
  if (response) return response

  const clientAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!consumeRateLimit(`apk-upload:${user.ownerUserId}:${clientAddress}`, 20, 15 * 60 * 1000)) {
    return NextResponse.json({ message: 'Too many APK uploads. Try again later.' }, { status: 429 })
  }

  try {
    const upload = prepareStreamingMultipartUpload(request, {
      maxBytes: maxApkUploadBytes,
      multipartOverheadBytes: maxMultipartOverheadBytes,
      missingMessage: 'Multipart APK file is required',
      tooLargeMessage: 'APK upload exceeds the 512 MB limit.'
    })
    if (!upload.ok) return upload.response

    const uploaded = await orchestratorApkUploadsClient.uploadApk(
      upload.body,
      user.ownerUserId,
      upload.contentType,
      request.signal
    )
    recordAuditEvent({
      actorUserId: user.ownerUserId,
      actorLabel: user.ownerUserId,
      category: 'apk',
      action: 'apk.upload',
      resourceType: 'apk',
      resourceId: uploaded.id,
      resourceLabel: uploaded.originalName,
      details: { originalName: uploaded.originalName },
      sourceIp: clientAddress,
      userAgent: request.headers.get('user-agent')
    })
    return NextResponse.json(uploaded)
  } catch (error) {
    const status = error instanceof OrchestratorRequestError ? error.status : 500
    const message = error instanceof Error ? error.message : 'APK upload failed.'
    return NextResponse.json({ message }, { status })
  }
}
