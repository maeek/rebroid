import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent } from '@/server/audit/events'
import { orchestratorApkUploadsClient } from '@/server/orchestrator/applications/apk-client'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { consumeRateLimit } from '@/server/rate-limit/in-memory'
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
    const contentLength = Number(request.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > maxApkUploadBytes + maxMultipartOverheadBytes) {
      return NextResponse.json({ message: 'APK upload exceeds the 512 MB limit.' }, { status: 413 })
    }
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.startsWith('multipart/form-data') || !request.body) {
      return NextResponse.json({ message: 'Multipart APK file is required' }, { status: 400 })
    }

    const uploaded = await orchestratorApkUploadsClient.uploadApk(request.body, user.ownerUserId, contentType)
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
