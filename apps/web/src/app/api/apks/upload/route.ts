import { NextRequest, NextResponse } from 'next/server'
import { recordAuditEvent } from '@/server/audit/events'
import { orchestratorApplicationsClient } from '@/server/orchestrator/applications/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { consumeRateLimit } from '@/server/rate-limit/in-memory'
import { hasPermission } from '@/shared/permissions/permissions'

export const runtime = 'nodejs'
const maxApkUploadBytes = 512 * 1024 * 1024
const maxMultipartOverheadBytes = 1024 * 1024

export const POST = async (request: NextRequest) => {
  let user: Awaited<ReturnType<typeof getCurrentUserContext>>
  try {
    user = await getCurrentUserContext()
  } catch {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:upload-apk')) {
    return NextResponse.json({ message: 'APK upload permission is required' }, { status: 403 })
  }

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

    const uploaded = await orchestratorApplicationsClient.uploadApk(request.body, user.ownerUserId, contentType)
    recordAuditEvent(user.ownerUserId, 'apk.upload', uploaded.id, { originalName: uploaded.originalName })
    return NextResponse.json(uploaded)
  } catch (error) {
    const status = error instanceof OrchestratorRequestError ? error.status : 500
    const message = error instanceof Error ? error.message : 'APK upload failed.'
    return NextResponse.json({ message }, { status })
  }
}
